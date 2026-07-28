-- Game Art AI Database Schema

-- Model configurations
CREATE TABLE IF NOT EXISTS model_configs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('text', 'image', 'video', 'tool')),
  provider VARCHAR(100) NOT NULL,
  api_base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System prompts
CREATE TABLE IF NOT EXISTS system_prompts (
  id SERIAL PRIMARY KEY,
  tool_key VARCHAR(100) UNIQUE NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  description TEXT,
  prompt_content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('character', 'prop', 'ui', 'scene', 'animation_frame', 'image')),
  url TEXT NOT NULL,
  finalized BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks (async generation queue)
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  tool_key VARCHAR(100) NOT NULL,
  input_params JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  output_urls JSONB DEFAULT '[]',
  error_message TEXT,
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Generations (completed task history)
CREATE TABLE IF NOT EXISTS generations (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  tool_key VARCHAR(100) NOT NULL,
  input_params JSONB DEFAULT '{}',
  output_urls JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system prompts
INSERT INTO system_prompts (tool_key, tool_name, description, prompt_content) VALUES
('text_to_image', '文生图', '将用户描述转化为专业的图片生成提示词', '你是游戏美术提示词工程师。将用户的简短描述转化为专业的图片生成提示词。要求：1) 补充细节描述（光影、材质、构图）2) 保持风格一致性 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('image_to_image', '图生图', '基于参考图进行编辑', '你是游戏美术编辑专家。分析用户的编辑需求，生成精确的图片修改提示词，保持原图整体风格。要求：1) 理解编辑意图 2) 保持风格一致性 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('inpaint', '局部重绘', '根据遮罩区域进行局部替换', '你是局部重绘专家。根据用户指定的遮罩区域和描述，生成仅影响该区域的精确提示词，确保与周围像素风格融合。要求：1) 理解遮罩区域 2) 生成融合自然的提示词 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('character_tpose', '基础角色生成', '生成标准站姿角色', '{user_prompt}

角色姿势严格要求：{pose}。角色必须严格按照此姿势站立，不得有任何偏差。
全身正面视角，完整展示从头到脚，角色居中占满画面。
纯色背景，背景颜色必须与角色主色调形成强烈反差以便后续抠图。
游戏精灵图风格，清晰利落的轮廓线条，统一的光源方向，高细节材质纹理。
画面中不得出现任何文字、UI元素、或其他角色。'),
('character_directions', '多方向角色生成', '基于单张角色图生成四/八方向视图（回退提示词）', '{user_prompt}

角色多方向视图：严格按照参考图的角色设计，生成{directions}方向视图。
将每个方向视图均匀排列在精灵图表中，保持间距一致。
所有方向的视图必须保持完全相同的角色设计、比例、颜色、光照和细节水平。
每个方向视图清晰独立，角色在该角度下的外观完整可辨。
纯白色背景（#FFFFFF），均匀光照，无阴影投射到背景上。
游戏精灵图风格，清晰轮廓，高细节材质纹理。
画面中不得出现任何文字、UI元素、或其他角色。'),
('character_directions_4', '多方向生成(4方向)', '四方向角色视图：前/后/左/右宫格排列', '{user_prompt}

角色四方向视图：四宫格均匀排列，所有视图保持完全相同的角色设计、比例、颜色和细节。

宫格布局（从左到右、从上到下）：
- 1号宫格（左上）：角色朝向左侧，展示角色左侧面轮廓
- 2号宫格（右上）：角色朝向正上方（背面），背对相机视角，展示角色背面完整设计
- 3号宫格（左下）：角色朝向右侧，与1号宫格呈镜像对称，展示角色右侧面轮廓
- 4号宫格（右下）：角色朝向正下方（正面），正对用户视角，展示角色正面完整外观

纯白色背景（#FFFFFF），均匀光照，无阴影投射到背景上。宫格间有清晰分隔线。
游戏精灵图风格，清晰轮廓，高细节材质纹理。
画面中不得出现任何文字、UI元素、或其他角色。'),
('character_directions_8', '多方向生成(8方向)', '八方向角色视图：含对角线方向九宫格排列', '{user_prompt}

角色八方向视图：九宫格均匀排列，所有视图保持完全相同的角色设计、比例、颜色和细节。

宫格布局（从左到右、从上到下）：
- 1号宫格（左上）：角色朝向左上方（西北方向），45度斜角
- 2号宫格（中上）：角色朝向正上方（背面），背对相机视角，展示角色背面完整设计
- 3号宫格（右上）：角色朝向右上方（东北方向），45度斜角
- 4号宫格（左中）：角色朝向正左方，展示角色左侧面轮廓
- 5号宫格（中心）：角色朝向正下方（正面），正对用户视角，展示角色正面完整外观（主视图）
- 6号宫格（右中）：角色朝向正右方，展示角色右侧面轮廓
- 7号宫格（左下）：角色朝向左下方（西南方向），45度斜角
- 8号宫格（中下）：角色朝向正下方（正面），备用的正面视图
- 9号宫格（右下）：角色朝向右下方（东南方向），45度斜角

纯白色背景（#FFFFFF），均匀光照，无阴影投射到背景上。宫格间有清晰分隔线。
游戏精灵图风格，清晰轮廓，高细节材质纹理。
画面中不得出现任何文字、UI元素、或其他角色。'),
('character_part_split', '角色部件拆分', '将角色拆分为独立部件', '{user_prompt}

角色部件拆分表：将角色拆分为独立部件并排列展示。
包含头部、身体躯干、左臂、右臂、左腿、右腿，以及武器、配饰等附加部件（如有）。
每个部件单独展示，保持与原角色完全一致的设计风格、颜色和比例。
部件之间保持均匀间距，每个部件下方标注部件名称。
纯绿色色背景（#00FF00），以便后续程序化抠图和组装。
游戏精灵图风格，清晰轮廓，高细节材质纹理。
画面中不得出现除部件名称外的任何文字或UI元素。'),
('character_three_view', '三视图生成', '生成角色正面/侧面/背面三视图', '{user_prompt}

角色三视图：正面视图、侧面视图、背面视图，三个视图水平等距排列在同一行。
所有视图保持完全相同的角色设计、比例、颜色和细节，确保各视角间的一致性。
每个视图清晰展示该角度下的角色完整外观，视图之间有清晰分隔线。
纯白色背景（#FFFFFF），均匀光照，无阴影投射到背景上。
游戏精灵图风格，清晰轮廓，高细节材质纹理。
画面中不得出现任何文字、UI元素、或其他角色。'),
('animation_text', '文字描述动画', '根据角色图和动作描述生成动画', '你是游戏动画师。根据角色图和动作描述，生成适合帧动画的提示词。要求：1) 保持角色在各帧间的一致性 2) 动作流畅自然 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('animation_skeleton', '骨骼动画', '根据骨骼控制点生成动画', '你是游戏动画师。根据骨骼控制点生成动画帧。要求：1) 保持角色结构一致 2) 动作符合骨骼约束 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('animation_frame_extract', '帧提取', '从宫格图中提取动画帧', '你是游戏动画师。从宫格图中提取并排列动画帧序列。要求：1) 正确识别帧顺序 2) 保持帧间一致性 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('prop_generate', '道具生成', '根据描述生成游戏道具', '你是游戏道具设计师。根据描述生成游戏道具。要求：1) 包含材质、光影、比例细节 2) 风格统一 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('prop_variant', '道具变体', '基于已有道具生成变体', '你是游戏道具设计师。基于已有道具生成变体（换色、换材质、换品质等）。要求：1) 保持基础结构 2) 变体差异化明显 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('ui_layout_generate', 'UI布局生成', '根据描述生成UI布局', '你是游戏UI设计师。根据描述生成完整的游戏UI布局。要求：1) 注意组件层次 2) 视觉引导清晰 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('ui_component_place', 'UI组件摆放', '调整UI组件位置和样式', '你是游戏UI设计师。调整UI组件的位置和样式。要求：1) 布局合理 2) 视觉平衡 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('ui_component_split', 'UI组件拆分', '将UI拆分为独立组件', '你是游戏UI设计师。将完整UI拆分为独立组件（按钮、面板、图标等）。要求：1) 组件边界清晰 2) 可独立使用 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('scene_map_generate', '地图生成', '根据描述生成游戏地图', '你是游戏场景设计师。根据描述生成游戏地图。要求：1) 注意透视关系 2) tileable特性 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}'),
('scene_map_split', '地图组件拆分', '将地图拆分为tileset组件', '你是游戏场景设计师。将地图拆分为可复用的tileset组件（地形、建筑、装饰等）。要求：1) 组件可拼接 2) 风格统一 3) 输出中文提示词。4) 纯色背景，保留主体大小20%的空白边缘。用户描述：{user_prompt}')
ON CONFLICT (tool_key) DO NOTHING;
