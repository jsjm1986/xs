// 获取DOM元素
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
const novelContent = document.getElementById('novelContent');
const loadingSection = document.querySelector('.loading-section');
const progressSection = document.querySelector('.progress-section');
const progressFill = document.querySelector('.progress-fill');
const progressPercentage = document.querySelector('.progress-percentage');
const steps = document.querySelectorAll('.step');
const settingsPanel = document.querySelector('.settings-panel');
const actionButtons = document.querySelector('.action-buttons');
const aiStatus = document.querySelector('.ai-status span');
const statValues = document.querySelectorAll('.stat-value');

// 计时器变量
let startTime;
let timerInterval;

// Deepseek API配置
const DEEPSEEK_API_KEY = 'sk-88abc026efcc4b048e66f30ca922040a';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 配置参数
const CONFIG = {
    minWordsPerChapter: 2000,
    maxWordsPerChapter: 5000,
    maxTokensPerRequest: 4000,
    maxChaptersPerBatch: 5,
    delayBetweenBatches: 2000,
    retryAttempts: 3,
    retryDelay: 1000,
    chapterLength: {
        short: { min: 1500, max: 2500 },
        medium: { min: 3000, max: 4000 },
        long: { min: 5000, max: 7000 }
    },
    characterCount: {
        simple: { min: 2, max: 3 },
        medium: { min: 4, max: 6 },
        complex: { min: 7, max: 10 }
    }
};

// 小说生成状态
let currentNovel = {
    title: '',
    outline: '',
    characters: [],
    chapters: [],
    worldSettings: {},
    genre: '',
    style: '',
    settings: {
        writeStyle: '',
        chapterLength: '',
        characterComplexity: '',
        plotComplexity: '',
        specialElements: []
    },
    currentStep: 0,
    totalWords: 0,
    generatedChapters: 0
};

// 文字动画配置
const TEXT_ANIMATION = {
    streamDelay: 20,  // 每个字符的延迟（毫秒）
    chunkSize: 5,     // 每次添加的字符数
    punctuationPause: 150  // 标点符号后的停顿（毫秒）
};

// 大纲生成相关配置
const OUTLINE_CONFIG = {
    minChapterWords: 2000,
    maxChapterWords: 5000,
    plotPoints: {
        introduction: 0.1,    // 开篇/引子
        risingAction: 0.3,    // 铺垫/发展
        climax: 0.2,         // 高潮
        fallingAction: 0.3,   // 转折/延展
        resolution: 0.1      // 结局/收尾
    },
    verificationPoints: [
        "故事背景是否完整",
        "人物动机是否明确",
        "情节是否连贯",
        "冲突是否充分",
        "结局是否合理"
    ]
};

// 初始化数字输入控制
document.querySelector('.minus').addEventListener('click', () => {
    const input = document.getElementById('chapterCount');
    if (input.value > 1) {
        input.value = parseInt(input.value) - 1;
    }
});

document.querySelector('.plus').addEventListener('click', () => {
    const input = document.getElementById('chapterCount');
    if (input.value < 50) {
        input.value = parseInt(input.value) + 1;
    }
});

// 更新进度条和步骤指示器
function updateProgress(step, totalSteps = 5) {
    const progress = (step / totalSteps) * 100;
    progressFill.style.width = `${progress}%`;
    progressPercentage.textContent = `${Math.round(progress)}%`;
    
    steps.forEach((stepElement, index) => {
        if (index < step) {
            stepElement.classList.add('completed');
            stepElement.classList.remove('active');
        } else if (index === step) {
            stepElement.classList.add('active');
            stepElement.classList.remove('completed');
        } else {
            stepElement.classList.remove('completed', 'active');
        }
    });
}

// 更新生成状态
function updateGenerationStatus() {
    // 更新统计数据
    statValues[0].textContent = currentNovel.generatedChapters;
    statValues[1].textContent = currentNovel.totalWords;
    
    // 更新AI状态
    aiStatus.textContent = '正在创作中...';
}

// 更新计时器显示
function updateTimer() {
    const now = new Date().getTime();
    const timeElapsed = now - startTime;
    const minutes = Math.floor(timeElapsed / 60000);
    const seconds = Math.floor((timeElapsed % 60000) / 1000);
    statValues[2].textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 开始计时器
function startTimer() {
    startTime = new Date().getTime();
    timerInterval = setInterval(updateTimer, 1000);
}

// 停止计时器
function stopTimer() {
    clearInterval(timerInterval);
}

// 修改生成小说的主要函数
async function generateNovel() {
    const title = document.getElementById('novelTitle').value;
    const plotIdea = document.getElementById('plotIdea').value;
    const novelType = document.getElementById('novelType').value;
    const writeStyle = document.getElementById('writeStyle').value;
    const chapterCount = parseInt(document.getElementById('chapterCount').value);
    const chapterLength = document.getElementById('chapterLength').value;
    const characterComplexity = document.getElementById('characterComplexity').value;
    const plotComplexity = document.getElementById('plotComplexity').value;

    // 获取特殊元素设置
    const specialElements = [];
    if (document.getElementById('hasRomance').checked) specialElements.push('romance');
    if (document.getElementById('hasConflict').checked) specialElements.push('conflict');
    if (document.getElementById('hasMystery').checked) specialElements.push('mystery');
    if (document.getElementById('hasHumor').checked) specialElements.push('humor');

    if (!title) {
        alert('请输入小说标题！');
        return;
    }

    if (!DEEPSEEK_API_KEY) {
        alert('请在代码中设置Deepseek API密钥！');
        return;
    }

    // 更新API检查逻辑
    aiStatus.textContent = 'API连接检查中...';
    const isConnected = await checkApiConnection();
    if (!isConnected) {
        const proceed = confirm('无法连接到AI服务。是否使用备用方案继续？');
        if (!proceed) {
            aiStatus.textContent = 'API连接失败';
            return;
        }
        aiStatus.textContent = '使用备用方案';
    } else {
        aiStatus.textContent = 'API连接正常';
    }

    // 初始化小说状态
    currentNovel = {
        title,
        outline: plotIdea,
        characters: [],
        chapters: [],
        worldSettings: {},
        genre: novelType,
        style: writeStyle,
        settings: {
            writeStyle,
            chapterLength,
            characterComplexity,
            plotComplexity,
            specialElements
        },
        currentStep: 0,
        totalWords: 0,
        generatedChapters: 0
    };

    // 显示UI元素
    progressSection.style.display = 'block';
    loadingSection.style.display = 'block';
    generateBtn.disabled = true;
    novelContent.innerHTML = '';
    settingsPanel.style.display = 'none';
    actionButtons.style.display = 'none';

    // 开始计时
    startTimer();
    aiStatus.textContent = 'AI引擎正在运行...';
    
    try {
        // 1. 生成世界观和背景设定
        updateLoadingText('正在构建世界观和背景设定...');
        updateProgress(0);
        const worldSettingsStream = await streamGenerateContent('world', generateWorldSettingsPrompt());
        currentNovel.worldSettings = worldSettingsStream;

        // 2. 生成人物设定
        updateLoadingText('正在设计人物角色...');
        updateProgress(1);
        const charactersStream = await streamGenerateContent('character', generateCharactersPrompt());
        currentNovel.characters = charactersStream;

        // 3. 生成详细大纲
        updateLoadingText('正在规划故事大纲...');
        updateProgress(2);
        
        // 更新加载提示
        const outlineSteps = ['构建故事架构', '设计关键情节', '分配章节内容', '优化完善大纲'];
        for (let i = 0; i < outlineSteps.length; i++) {
            updateLoadingText(`正在${outlineSteps[i]}...`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const outlineStream = await generateDetailedOutline(chapterCount);
        currentNovel.outline = outlineStream;

        // 4. 分批次生成章节
        updateProgress(3);
        const batches = Math.ceil(chapterCount / CONFIG.maxChaptersPerBatch);
        
        for (let batch = 0; batch < batches; batch++) {
            const startChapter = batch * CONFIG.maxChaptersPerBatch + 1;
            const endChapter = Math.min((batch + 1) * CONFIG.maxChaptersPerBatch, chapterCount);
            
            updateLoadingText(`正在创作第 ${startChapter} - ${endChapter} 章，共 ${chapterCount} 章...`);
            
            // 串行生成每批次的章节，以保证顺序和流式显示
            for (let i = startChapter; i <= endChapter; i++) {
                const chapterContent = await streamGenerateContent('chapter', generateChapterPrompt(i), {
                    chapterNumber: i
                });
                currentNovel.chapters.push(chapterContent);
                currentNovel.generatedChapters++;
                currentNovel.totalWords += countWords(chapterContent);
                updateGenerationStatus();
            }
            
            if (batch < batches - 1) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenBatches));
            }
        }

        // 5. 分段优化和润色
        updateLoadingText('正在进行最终润色...');
        updateProgress(4);
        const finalContent = await streamPolishNovel();
        
        // 显示最终结果
        updateProgress(5);
        settingsPanel.style.display = 'block';
        actionButtons.style.display = 'flex';
        
        // 更新最终统计
        updateGenerationStatus();
        aiStatus.textContent = '生成完成';
    } catch (error) {
        aiStatus.textContent = '生成出错';
        alert('生成小说时发生错误：' + error.message);
    } finally {
        stopTimer();
        loadingSection.style.display = 'none';
        generateBtn.disabled = false;
    }
}

// 生成提示词函数
function generateWorldSettingsPrompt() {
    const { genre, style, settings } = currentNovel;
    
    return `作为一位世界观构建专家，请为一部${genre}类型的小说《${currentNovel.title}》创建完整的世界观和背景设定。

写作要求：
- 写作风格：${style}风格
- 世界复杂度：${settings.plotComplexity === 'complex' ? '高度复杂' : settings.plotComplexity === 'medium' ? '中等复杂' : '简单明了'}
${settings.specialElements.length > 0 ? `- 特殊元素：${settings.specialElements.join('、')}` : ''}

需要包含：
1. 时代背景
2. 世界规则
3. 社会制度
4. 重要场景
5. 特殊元素
${currentNovel.outline ? '参考情节概要：' + currentNovel.outline : ''}`;
}

function generateCharactersPrompt() {
    const { settings } = currentNovel;
    const characterCount = CONFIG.characterCount[settings.characterComplexity];
    
    return `基于已有的世界观设定，为小说《${currentNovel.title}》创建一组富立体的角色。

创作要求：
- 主要人物数量：${characterCount.min}-${characterCount.max}个
- 人物复杂度：${settings.characterComplexity}
- 写作风格：${currentNovel.style}
${settings.specialElements.includes('romance') ? '- 需要包含适合发展感情线的角色' : ''}
${settings.specialElements.includes('conflict') ? '- 需要包含对立/对抗角色' : ''}

请设计：
1. 主角设定（性格、背景、动机）
2. 重要配角设定
3. 角色关系网络
4. 人物成长轨迹

参考世界观：${JSON.stringify(currentNovel.worldSettings)}`;
}

// 修改大纲生成函数
async function generateDetailedOutline(chapterCount) {
    try {
        // 1. 生成故事核心架构
        const storyStructure = await generateStoryStructure();
        
        // 2. 生成关键情节点
        const plotPoints = await generatePlotPoints(storyStructure);
        
        // 3. 分配章节内容
        const chapterOutlines = await distributeChapters(plotPoints, chapterCount);
        
        // 4. 验证和优化大纲
        const verifiedOutline = await verifyAndOptimizeOutline(chapterOutlines);
        
        return verifiedOutline;
    } catch (error) {
        console.error('大纲生成错误:', error);
        throw error;
    }
}

// 生成故事核心架构
async function generateStoryStructure() {
    const prompt = `作为一位专业的小说策划师，请为《${currentNovel.title}》创建完整的故事架构。
背景信息：
- 类型：${currentNovel.genre}
- 世界观：${JSON.stringify(currentNovel.worldSettings)}
- 主要人物：${JSON.stringify(currentNovel.characters)}

请从以下几个方面构建故事框架：
1. 核心主题
2. 主要矛盾
3. 故事主线
4. 重要支线
5. 情感线索

要求：
- 每个方面都要详细展开
- 确保逻辑性和连贯性
- 符合${currentNovel.genre}类型的特点
- 结合已有的世界观和人物设定`;

    return await streamGenerateContent('outline-structure', prompt);
}

// 生成关键情节点
async function generatePlotPoints(storyStructure) {
    const prompt = `基于已有的故事架构，为《${currentNovel.title}》设计详细的关键情节点。
故事架构：${storyStructure}

请按照以下比例分配情节：
1. 开篇/引子 (${OUTLINE_CONFIG.plotPoints.introduction * 100}%)：
   - 世界背景展示
   - 主要人物登场
   - 核心问题引入

2. 铺垫/发展 (${OUTLINE_CONFIG.plotPoints.risingAction * 100}%)：
   - 矛盾积累
   - 人物关系发展
   - 支线故事展开

3. 高潮 (${OUTLINE_CONFIG.plotPoints.climax * 100}%)：
   - 主要冲突爆发
   - 关键选择
   - 重要转折

4. 转折/延展 (${OUTLINE_CONFIG.plotPoints.fallingAction * 100}%)：
   - 后续发展
   - 次要矛盾解决
   - 情感线推进

5. 结局/收尾 (${OUTLINE_CONFIG.plotPoints.resolution * 100}%)：
   - 主线完结
   - 人物归宿
   - 主题升华

要求：
- 每个阶段的情节点要详细具体
- 确保情节的起承转合
- 保持悬念和张力
- 照顾到所有主要人物的发展`;

    return await streamGenerateContent('outline-plots', prompt);
}

// 分配章节内容
async function distributeChapters(plotPoints, chapterCount) {
    const prompt = `基于已规划的情节点，将故事内容分配到${chapterCount}章中。
情节规划：${plotPoints}

分配要求：
1. 每章字数范围：${OUTLINE_CONFIG.minChapterWords}-${OUTLINE_CONFIG.maxChapterWords}字
2. 每章都要包含：
   - 章节主题
   - 核心事件
   - 次要情节
   - 人物互动
   - 环境描写
3. 章节之间要有合理的承接
4. 重要情节要分配足够的篇幅
5. 次要情节要适当分配

请详细列出每章的具体内容规划。`;

    return await streamGenerateContent('outline-chapters', prompt);
}

// 验证和优化大纲
async function verifyAndOptimizeOutline(chapterOutlines) {
    const prompt = `请对《${currentNovel.title}》的章节大纲进行全面审查和优化。
当前大纲：${chapterOutlines}

请检查以下方面：
1. 完整性检查：
${OUTLINE_CONFIG.verificationPoints.map(point => `   - ${point}`).join('\n')}

2. 优化建议：
   - 情节节奏是否合适
   - 人物出场是否均衡
   - 悬念设置是否恰当
   - 细节描写是否充分
   - 主题表达是否深入

3. 具体修改：
   - 补充不足之处
   - 调整不合理部分
   - 强化重要情节
   - 完善人物刻画
   - 优化情节转折

请给出改后的完整大纲。`;

    return await streamGenerateContent('outline-verify', prompt);
}

function generateOutlinePrompt(chapterCount) {
    return `基于已有的世界观和人物设定，为小说《${currentNovel.title}》创建详细的章节大纲。
要求：
1. 规划${chapterCount}章的内容
2. 每章节的主要情节（${CONFIG.minWordsPerChapter}-${CONFIG.maxWordsPerChapter}字）
3. 情节发展的起承转合
4. 人物互动和冲突
5. 关键转折点
参考设定：
世界观：${JSON.stringify(currentNovel.worldSettings)}
人物：${JSON.stringify(currentNovel.characters)}`;
}

function generateChapterPrompt(chapterNumber) {
    const { settings } = currentNovel;
    const wordCount = CONFIG.chapterLength[settings.chapterLength];
    
    // 获取所有新增设置的值
    const narrativePerspective = document.getElementById('narrativePerspective').value;
    const perspectiveChange = document.getElementById('perspectiveChange').value;
    const detailLevel = document.getElementById('detailLevel').value;
    const dialogueRatio = document.getElementById('dialogueRatio').value;
    const emotionalTone = document.getElementById('emotionalTone').value;
    const emotionalChange = document.getElementById('emotionalChange').value;
    const timeBackground = document.getElementById('timeBackground').value;
    const geography = document.getElementById('geography').value;
    const languageStyle = document.getElementById('languageStyle').value;
    const paragraphLength = document.getElementById('paragraphLength').value;
    const rhetoricLevel = document.getElementById('rhetoricLevel').value;

    // 获取写作技巧设置
    const useMetaphor = document.getElementById('useMetaphor').checked;
    const useSymbolism = document.getElementById('useSymbolism').checked;
    const useFlashback = document.getElementById('useFlashback').checked;
    const useStream = document.getElementById('useStream').checked;

    // 获取世界观设置
    const hasMagic = document.getElementById('hasMagic').checked;
    const hasTechnology = document.getElementById('hasTechnology').checked;
    const hasReligion = document.getElementById('hasReligion').checked;
    const hasPolitics = document.getElementById('hasPolitics').checked;
    
    return `请基于大纲创作《${currentNovel.title}》的第${chapterNumber}章。

创作要求：
- 写作风格：${currentNovel.style}
- 字数要求：${wordCount.min}-${wordCount.max}字
- 叙事视角：${narrativePerspective}${perspectiveChange !== 'fixed' ? `，采用${perspectiveChange}方式切换` : ''}
- 情节发展：${settings.plotComplexity === 'complex' ? '多线并行' : settings.plotComplexity === 'medium' ? '双线交织' : '单线发展'}

描写要求：
- 细节程度：${getDetailLevelDescription(detailLevel)}
- 对话比重：${getDialogueRatioDescription(dialogueRatio)}
- 段落长度：${paragraphLength}
- 修辞水平：${getRhetoricLevelDescription(rhetoricLevel)}

情感设置：
- 情感基调：${emotionalTone}
- 情感发展：${emotionalChange}

世界观要素：
- 时代背景：${timeBackground}
- 地理环境：${geography}
${hasMagic ? '- 需要体现魔法体系\n' : ''}${hasTechnology ? '- 需要展现科技元素\n' : ''}${hasReligion ? '- 需要涉及宗教信仰\n' : ''}${hasPolitics ? '- 需要体现政治制度\n' : ''}

写作技巧要求：
${useMetaphor ? '- 适当运用比喻修辞\n' : ''}${useSymbolism ? '- 使用象征手法\n' : ''}${useFlashback ? '- 插入回忆/闪回片段\n' : ''}${useStream ? '- 运用意识流手法\n' : ''}

语言风格：
- 采用${languageStyle}风格
${settings.specialElements.map(element => `- ${getElementRequirement(element)}`).join('\n')}

章节要求：
1. 遵循大纲设定的情节发展
2. 融入已设定的世界观元素
3. 展现人物性格和互动
4. 确保与前文的连贯性
5. 为后续情节做好铺垫

参考信息：
大纲：${currentNovel.outline}
已生成章节数：${chapterNumber - 1}`;
}

// 添加辅助函数来描述各个级别
function getDetailLevelDescription(level) {
    const descriptions = {
        '1': '简练为主，点到即止',
        '2': '适度描写，重点突出',
        '3': '中等细节，均衡展现',
        '4': '细致刻画，重视细节',
        '5': '极度细腻，全面展现'
    };
    return descriptions[level] || '中等细节，均衡展现';
}

function getDialogueRatioDescription(level) {
    const descriptions = {
        '1': '以叙述为主，对话点缀',
        '2': '对话适中，叙述为主',
        '3': '叙述对话均衡',
        '4': '对话为主，叙述点缀',
        '5': '大量对话，戏剧化展现'
    };
    return descriptions[level] || '叙述对话均衡';
}

function getRhetoricLevelDescription(level) {
    const descriptions = {
        '1': '朴实无华，直白表达',
        '2': '适度修饰，重在表意',
        '3': '修辞适中，雅俗结合',
        '4': '善用修辞，语言优美',
        '5': '华丽丰富，极尽修饰'
    };
    return descriptions[level] || '修辞适中，雅俗结合';
}

// 获取特殊元素的具体要求
function getElementRequirement(element) {
    const requirements = {
        romance: '注意感情线的自然发展',
        conflict: '突出冲突和对抗元素',
        mystery: '保持适当的悬疑感',
        humor: '适时添加幽默元素'
    };
    return requirements[element] || '';
}

// 流式生成内容的通用函数
async function streamGenerateContent(type, prompt, options = {}) {
    let content = '';
    const targetElement = getTargetElement(type, options);
    
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "你是一位专业的小说创作者，精通故事构建、人物塑造和文字表达。"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                stream: true
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.trim() === 'data: [DONE]') continue;
                
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                            const text = data.choices[0].delta.content;
                            content += text;
                            await streamText(targetElement, text, {
                                append: true,
                                className: getClassName(type),
                                isChapter: type === 'chapter'
                            });
                        }
                    } catch (parseError) {
                        console.warn('JSON解析警告:', parseError);
                        continue; // 跳过解析错误的行
                    }
                }
            }
        }
    } catch (error) {
        console.error('流式生成错误:', error);
        // 使用备用方案
        content = await fallbackGeneration(prompt);
        await streamText(targetElement, content, {
            className: getClassName(type),
            isChapter: type === 'chapter'
        });
    }

    return content;
}

// 获取目标元素
function getTargetElement(type, options = {}) {
    switch (type) {
        case 'world':
            return document.getElementById('worldSettings');
        case 'character':
            return document.getElementById('characterSettings');
        case 'outline':
            return document.getElementById('storyOutline');
        case 'chapter':
            return novelContent;
        default:
            return novelContent;
    }
}

// 获取样式类名
function getClassName(type) {
    switch (type) {
        case 'world':
        case 'character':
        case 'outline':
            return 'settings-content';
        case 'chapter':
            return 'chapter-content';
        default:
            return 'paragraph';
    }
}

// 流式润色小说
async function streamPolishNovel() {
    const sectionSize = 5;
    const sections = Math.ceil(currentNovel.chapters.length / sectionSize);
    let polishedContent = [];

    for (let i = 0; i < sections; i++) {
        const start = i * sectionSize;
        const end = Math.min((i + 1) * sectionSize, currentNovel.chapters.length);
        const sectionChapters = currentNovel.chapters.slice(start, end);

        updateLoadingText(`正在润色第 ${start + 1} - ${end} 章...`);
        
        const prompt = `请对这部小说的第${start + 1}至第${end}章进行优化和润色。
要求：
1. 检查情节连贯性
2. 优化语言表达
3. 强化人物形象
4. 突出主题思想
5. 完善细节描写
原文：${sectionChapters.join('\n')}`;

        const polishedSection = await streamGenerateContent('polish', prompt);
        polishedContent.push(polishedSection);

        if (i < sections - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return polishedContent.join('\n\n');
}

// 计算字数
function countWords(text) {
    return text.replace(/\s/g, '').length;
}

// 格式化内容显示
function formatContent(content) {
    return content.split('\n').map(line => `<p>${line}</p>`).join('');
}

// 更新加载提示文本
function updateLoadingText(text) {
    const loadingText = loadingSection.querySelector('.loading-text');
    loadingText.textContent = text;
}

// 生成世界观和背景设定
async function generateWorldSettings() {
    const prompt = `作为一位世界观构建专家，请为一部${currentNovel.genre}类型的小说《${currentNovel.title}》创建完整的世界观和背景设定。
需要包含：
1. 时代背景
2. 世界规则
3. 社会制度
4. 重要场景
5. 特殊元素
${currentNovel.outline ? '参考情节概要：' + currentNovel.outline : ''}`;

    const response = await callAPI(prompt, 0.7);
    await updateSettingsPanel('world', response);
    return response;
}

// 生成人物设定
async function generateCharacters() {
    const prompt = `基于已有的世界观设定，为小说《${currentNovel.title}》创建一组富立体的角色
要求：
1. 主角设定（性格、背景、动机）
2. 重要配角设定
3. 角色关系网络
4. 人物成长轨迹
参考世界观：${JSON.stringify(currentNovel.worldSettings)}`;

    const response = await callAPI(prompt, 0.7);
    return response;
}

// 生成单个章节
async function generateChapter(chapterNumber) {
    const prompt = `请基于大纲创作《${currentNovel.title}》的第${chapterNumber}章。
要求：
1. 遵循大纲设定的情节发展
2. 融入已设定的世界观元素
3. 展现人物性格和互动
4. 确保与前文的连贯性
5. 为后续情节做好铺垫
参考信息：
大纲：${currentNovel.outline}
已生成章节数：${chapterNumber - 1}`;

    const response = await callAPI(prompt, 0.8);
    return response;
}

// 调用API的通用函数
async function callAPI(prompt, temperature = 0.7) {
    let attempts = 0;
    
    while (attempts < CONFIG.retryAttempts) {
        try {
            const response = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Accept': 'application/json',
                    'User-Agent': 'NovelGenerator/1.0'
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: "你是一位专业的小说创作者，精通故事构建、人物塑造和文字表达。"
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: temperature,
                    max_tokens: 4000,
                    top_p: 0.95,
                    frequency_penalty: 0.1,
                    presence_penalty: 0.1,
                    stop: null
                }),
                timeout: 30000
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API错误详情:', errorData);
                throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
            }

            const data = await response.json();
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('API返回数据格式不正确');
            }
            return data.choices[0].message.content;
        } catch (error) {
            attempts++;
            console.error(`API调用错误 (尝试 ${attempts}/${CONFIG.retryAttempts}):`, error);
            
            if (attempts === CONFIG.retryAttempts) {
                // 如果是最后一次尝试，则改用备用方案
                return await fallbackGeneration(prompt);
            }
            
            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
        }
    }
}

// 备用生成方案
async function fallbackGeneration(prompt) {
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "你是一位专业的小说创作者，精通故事构建、人物塑造和文字表达。"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                stream: false // 使用非流式响应
            })
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('备用生成失败:', error);
        return `[生成失败] 由于技术原因，无法生成内容。请稍后重试。\n错误信息：${error.message}`;
    }
}

// 添加网络状态检测
async function checkApiConnection() {
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "test connection"
                    }
                ],
                max_tokens: 1
            })
        });
        
        if (response.status === 401) {
            throw new Error('API密钥无效');
        }
        
        if (response.status === 404) {
            throw new Error('API端点不存在');
        }
        
        return response.ok;
    } catch (error) {
        console.error('API连接检查失败:', error);
        if (error.message.includes('API密钥无效')) {
            alert('API密钥无效，请检查密钥设置');
        } else if (error.message.includes('API端点不存在')) {
            alert('API端点无法访问，请检查网络连接');
        }
        return false;
    }
}

// 流式显示文本
async function streamText(element, text, options = {}) {
    const {
        delay = TEXT_ANIMATION.streamDelay,
        chunkSize = TEXT_ANIMATION.chunkSize,
        className = '',
        isChapter = false
    } = options;

    // 清空现有内容
    if (!options.append) {
        element.innerHTML = '';
    }

    // 创建新的段落元素
    const paragraph = document.createElement('div');
    paragraph.className = className;
    element.appendChild(paragraph);

    // 如果是章节题，添加特殊样式
    if (isChapter) {
        paragraph.classList.add('chapter-title');
    }

    let currentText = '';
    const chars = text.split('');
    
    for (let i = 0; i < chars.length; i += chunkSize) {
        const chunk = chars.slice(i, i + chunkSize).join('');
        currentText += chunk;
        
        // 检查是否包含标点符号
        const hasPunctuation = /[，。！？；：]/.test(chunk);
        
        paragraph.textContent = currentText;
        
        // 自动滚动到底部
        element.scrollTop = element.scrollHeight;
        
        // 标点符号处停顿更长时间
        await new Promise(resolve => 
            setTimeout(resolve, hasPunctuation ? TEXT_ANIMATION.punctuationPause : delay)
        );
    }
}

// 显示生成进度
async function displayProgress() {
    const progress = currentNovel.chapters.join('\n\n');
    await streamText(novelContent, progress, { append: true });
}

// 显示最终小说内容
async function displayNovel(content) {
    // 分段处理内容
    const sections = content.split(/(?=第[一二三四五六七八九十\d]+章)/);
    
    // 清空现有内容
    novelContent.innerHTML = '';
    
    // 逐章节显示
    for (const section of sections) {
        if (section.trim()) {
            // 检查是章节标题
            const isChapterTitle = /^第[一二三四五六七八九十\d]+章/.test(section);
            
            if (isChapterTitle) {
                // 提取章节标题
                const titleMatch = section.match(/^第[一二三四五六七八九十\d]+章[^\n]*/);
                const title = titleMatch ? titleMatch[0] : '';
                const content = section.replace(title, '').trim();
                
                // 显示章节标题
                await streamText(novelContent, title, {
                    className: 'chapter-title',
                    append: true,
                    delay: TEXT_ANIMATION.streamDelay * 2
                });
                
                // 显示章节内容
                if (content) {
                    await streamText(novelContent, '\n' + content, {
                        className: 'chapter-content',
                        append: true
                    });
                }
            } else {
                // 显示普通段落
                await streamText(novelContent, section, {
                    className: 'paragraph',
                    append: true
                });
            }
        }
    }
}

// 格式化小说内容
function formatNovelContent(content) {
    // 添加章节分隔符和样式
    content = content.replace(/第[一二三四五六七八九十\d]+章/g, '<h2 class="chapter-title">$&</h2>');
    // 添加段落格式
    content = content.replace(/\n\s*\n/g, '</p><p class="paragraph">');
    return `<p class="paragraph">${content}</p>`;
}

// 更新设定面板内容
async function updateSettingsPanel(type, content) {
    const element = document.getElementById(`${type}Settings`);
    if (element) {
        await streamText(element, content, {
            className: 'settings-content',
            delay: TEXT_ANIMATION.streamDelay / 2
        });
    }
}

// 下载小说
function downloadNovel() {
    const title = currentNovel.title;
    const content = `《${title}》\n\n` +
        `世界观设定：\n${JSON.stringify(currentNovel.worldSettings, null, 2)}\n\n` +
        `人物设定：\n${JSON.stringify(currentNovel.characters, null, 2)}\n\n` +
        `故事大纲：\n${currentNovel.outline}\n\n` +
        `正文：\n${currentNovel.chapters.join('\n\n')}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 切换设定面板显示
function toggleSettings() {
    const currentDisplay = settingsPanel.style.display;
    settingsPanel.style.display = currentDisplay === 'none' ? 'block' : 'none';
}

// 添加事件监听器
generateBtn.addEventListener('click', generateNovel);
downloadBtn.addEventListener('click', downloadNovel);
toggleSettingsBtn.addEventListener('click', toggleSettings); 

// 添加动画效果
generateBtn.addEventListener('mouseover', () => {
    generateBtn.querySelector('.btn-particles').style.opacity = '1';
});

generateBtn.addEventListener('mouseout', () => {
    generateBtn.querySelector('.btn-particles').style.opacity = '0';
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    aiStatus.textContent = 'AI引擎已就绪';
    updateProgress(0);
    // 初始化统计数据
    statValues[0].textContent = '0';
    statValues[1].textContent = '0';
    statValues[2].textContent = '00:00';
}); 

// 添加CSS样式
const style = document.createElement('style');
style.textContent = `
    .chapter-title {
        color: var(--primary-color);
        font-size: 1.5rem;
        font-weight: bold;
        margin: 2rem 0 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--border-color);
    }

    .chapter-content {
        text-indent: 2em;
        margin-bottom: 1rem;
        line-height: 1.8;
    }

    .paragraph {
        text-indent: 2em;
        margin-bottom: 1rem;
        line-height: 1.8;
        opacity: 0;
        animation: fadeIn 0.5s forwards;
    }

    .settings-content {
        line-height: 1.6;
        opacity: 0;
        animation: fadeIn 0.5s forwards;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .highlight {
        background: linear-gradient(120deg, var(--primary-color) 0%, var(--accent-color) 100%);
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        display: inline;
    }
`;
document.head.appendChild(style); 

// 添加工具提示
document.querySelectorAll('[data-tooltip]').forEach(element => {
    element.addEventListener('mouseenter', e => {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = e.target.dataset.tooltip;
        document.body.appendChild(tooltip);
        
        const rect = e.target.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
    });
    
    element.addEventListener('mouseleave', () => {
        document.querySelector('.tooltip')?.remove();
    });
}); 