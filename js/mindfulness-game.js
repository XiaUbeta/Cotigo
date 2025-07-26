class MindfulnessGame {
    constructor() {
        this.isActive = false;
        this.currentMode = 'idle'; // idle, meditation
        this.sessionStartTime = null;
        this.sessionData = [];
        
        // 正念训练参数
        this.targetStressLevel = 0.3; // 目标压力水平
        this.targetAttentionLevel = 0.7; // 目标注意力水平
        this.targetRelaxationLevel = 0.8; // 目标放松度
        
        
        // 放松引导系统
        this.relaxationGuide = {
            isActive: false,
            currentTechnique: 'progressive', // progressive, visualization, mindfulness
            techniques: {
                progressive: {
                    name: '渐进式放松',
                    steps: [
                        '放松你的双脚和脚踝',
                        '放松小腿和膝盖',
                        '放松大腿和臀部',
                        '放松腹部和腰部',
                        '放松胸部和肩膀',
                        '放松双臂和手掌',
                        '放松颈部和面部',
                        '整个身体完全放松'
                    ],
                    duration: 8000 // 每步8秒
                },
                visualization: {
                    name: '想象放松',
                    steps: [
                        '想象你在一个宁静的海滩',
                        '感受温暖的阳光洒在身上',
                        '听到轻柔的海浪声',
                        '感受微风轻抚面颊',
                        '让所有紧张完全消散',
                        '沉浸在这份宁静中'
                    ],
                    duration: 10000 // 每步10秒
                },
                mindfulness: {
                    name: '正念观察',
                    steps: [
                        '观察当下的感受',
                        '不评判，只是观察',
                        '注意身体的感觉',
                        '观察身体的感觉',
                        '觉察内心的平静',
                        '保持当下的觉知'
                    ],
                    duration: 12000 // 每步12秒
                }
            },
            currentStep: 0,
            stepStartTime: 0,
            totalSteps: 0
        };
        
        
        // 进度跟踪
        this.progress = {
            stress: { current: 0, target: this.targetStressLevel, improvement: 0 },
            attention: { current: 0, target: this.targetAttentionLevel, improvement: 0 },
            relaxation: { current: 0, target: this.targetRelaxationLevel, improvement: 0 }
        };
        
        // 反馈系统
        this.feedback = {
            lastMessage: '',
            messageTime: 0,
            achievements: []
        };
        
        // 音频反馈（如果需要）
        this.audioContext = null;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('音频上下文不可用');
        }
        
        this.callbacks = {
            onModeChange: null,
            onProgressUpdate: null,
            onFeedback: null,
            onRelaxationGuide: null
        };
    }
    
    setCallback(event, callback) {
        if (this.callbacks.hasOwnProperty('on' + event.charAt(0).toUpperCase() + event.slice(1))) {
            this.callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)] = callback;
        }
    }
    
    // 启动放松引导模式
    startRelaxationGuide(technique = 'progressive') {
        this.currentMode = 'relaxation';
        this.isActive = true;
        this.relaxationGuide.isActive = true;
        this.relaxationGuide.currentTechnique = technique;
        this.relaxationGuide.currentStep = 0;
        this.relaxationGuide.stepStartTime = Date.now();
        
        const currentTechniqueData = this.relaxationGuide.techniques[technique];
        this.relaxationGuide.totalSteps = currentTechniqueData.steps.length;
        
        console.log(`开始${currentTechniqueData.name}引导`);
        
        if (this.callbacks.onModeChange) {
            this.callbacks.onModeChange('relaxation');
        }
        
        this.provideFeedback(`开始${currentTechniqueData.name}，跟随指引放松身心`);
        this.updateRelaxationStep();
    }
    
    // 更新放松引导步骤
    updateRelaxationStep() {
        if (!this.relaxationGuide.isActive) return;
        
        const technique = this.relaxationGuide.techniques[this.relaxationGuide.currentTechnique];
        const currentStep = this.relaxationGuide.currentStep;
        
        if (currentStep < technique.steps.length) {
            const stepText = technique.steps[currentStep];
            
            if (this.callbacks.onRelaxationGuide) {
                this.callbacks.onRelaxationGuide({
                    technique: this.relaxationGuide.currentTechnique,
                    step: currentStep,
                    stepText: stepText,
                    totalSteps: technique.steps.length,
                    progress: (currentStep + 1) / technique.steps.length
                });
            }
            
            this.provideFeedback(stepText);
            
            // 安排下一步
            setTimeout(() => {
                this.relaxationGuide.currentStep++;
                this.relaxationGuide.stepStartTime = Date.now();
                this.updateRelaxationStep();
            }, technique.duration);
        } else {
            // 引导完成
            this.provideFeedback('放松引导完成，保持这种平静的状态');
            this.relaxationGuide.isActive = false;
        }
    }
    
    // 停止放松引导
    stopRelaxationGuide() {
        this.relaxationGuide.isActive = false;
        if (this.callbacks.onRelaxationGuide) {
            this.callbacks.onRelaxationGuide({
                technique: null,
                step: -1,
                stepText: '',
                totalSteps: 0,
                progress: 0
            });
        }
    }
    
    startMeditationMode() {
        this.currentMode = 'meditation';
        this.isActive = true;
        this.sessionStartTime = Date.now();
        this.sessionData = [];
        
        console.log('开始正念冥想模式');
        
        if (this.callbacks.onModeChange) {
            this.callbacks.onModeChange('meditation');
        }
        
        this.provideFeedback('开始正念冥想。放松身体，专注当下。');
    }
    
    
    stop() {
        this.isActive = false;
        this.relaxationGuide.isActive = false;
        this.currentMode = 'idle';
        
        if (this.callbacks.onModeChange) {
            this.callbacks.onModeChange('idle');
        }
        
        // 停止所有引导
        this.stopRelaxationGuide();
        
        this.generateSessionReport();
    }
    
    updateMetrics(metrics) {
        if (!this.isActive) return;
        
        // 更新当前进度
        this.progress.stress.current = metrics.stress;
        this.progress.attention.current = metrics.attention;
        this.progress.relaxation.current = metrics.relaxation;
        
        // 计算改善程度
        this.calculateImprovement();
        
        // 记录会话数据
        this.sessionData.push({
            timestamp: Date.now(),
            metrics: { ...metrics },
            mode: this.currentMode
        });
        
        // 处理不同模式下的逻辑
        if (this.currentMode === 'meditation') {
            this.handleMeditationMode(metrics);
        } else if (this.currentMode === 'relaxation') {
            this.handleRelaxationMode(metrics);
        }
        
        // 更新进度回调
        if (this.callbacks.onProgressUpdate) {
            this.callbacks.onProgressUpdate(this.progress);
        }
    }
    
    handleMeditationMode(metrics) {
        const now = Date.now();
        
        // 提供实时反馈
        if (now - this.feedback.messageTime > 10000) { // 每10秒检查一次
            let message = '';
            
            if (metrics.stress > 0.7) {
                message = '压力水平较高，试着放松身心';
            } else if (metrics.attention < 0.4) {
                message = '注意力有些分散，回到当下的感受';
            } else if (metrics.relaxation > 0.8) {
                message = '很好！保持这种放松的状态';
            } else if (metrics.stress < 0.3 && metrics.attention > 0.6) {
                message = '状态很棒！继续保持专注';
            }
            
            if (message && message !== this.feedback.lastMessage) {
                this.provideFeedback(message);
            }
        }
        
        // 检查成就
        this.checkAchievements(metrics);
    }
    
    
    handleRelaxationMode(metrics) {
        // 根据放松度调整引导节奏
        if (this.relaxationGuide.isActive) {
            const technique = this.relaxationGuide.techniques[this.relaxationGuide.currentTechnique];
            
            // 如果用户放松度很高，可以适当加快节奏
            if (metrics.relaxation > 0.8) {
                // 用户已经很放松，可以进入更深层次的引导
                if (Date.now() - this.feedback.messageTime > 8000) {
                    this.provideFeedback('很好，保持这种深度放松的状态');
                }
            } else if (metrics.stress > 0.6) {
                // 用户压力较高，需要更温和的引导
                if (Date.now() - this.feedback.messageTime > 6000) {
                    this.provideFeedback('放慢节奏，让紧张慢慢释放');
                }
            }
        }
        
        // 根据用户状态自动调整放松技巧
        if (metrics.stress > 0.7 && this.relaxationGuide.currentTechnique !== 'progressive') {
            // 压力很高时，切换到渐进式放松
            this.provideFeedback('切换到渐进式放松，更有效地释放压力');
        }
    }
    
    
    
    
    
    calculateImprovement() {
        // 计算相对于目标的改善程度
        this.progress.stress.improvement = Math.max(0, 
            (1 - this.progress.stress.current) - (1 - this.progress.stress.target)
        );
        this.progress.attention.improvement = Math.max(0, 
            this.progress.attention.current - this.progress.attention.target
        );
        this.progress.relaxation.improvement = Math.max(0, 
            this.progress.relaxation.current - this.progress.relaxation.target
        );
    }
    
    checkAchievements(metrics) {
        const achievements = [];
        
        // 检查各种成就条件
        if (metrics.stress < 0.2 && !this.feedback.achievements.includes('low_stress')) {
            achievements.push({ id: 'low_stress', name: '深度放松', description: '达到极低压力状态' });
            this.feedback.achievements.push('low_stress');
        }
        
        if (metrics.attention > 0.9 && !this.feedback.achievements.includes('high_focus')) {
            achievements.push({ id: 'high_focus', name: '专注大师', description: '达到极高注意力水平' });
            this.feedback.achievements.push('high_focus');
        }
        
        if (metrics.relaxation > 0.9 && !this.feedback.achievements.includes('deep_relaxation')) {
            achievements.push({ id: 'deep_relaxation', name: '禅定境界', description: '达到深度放松状态' });
            this.feedback.achievements.push('deep_relaxation');
        }
        
        // 检查持续时间成就
        if (this.sessionStartTime) {
            const sessionDuration = Date.now() - this.sessionStartTime;
            if (sessionDuration > 300000 && !this.feedback.achievements.includes('five_minutes')) { // 5分钟
                achievements.push({ id: 'five_minutes', name: '坚持不懈', description: '连续练习5分钟' });
                this.feedback.achievements.push('five_minutes');
            }
        }
        
        // 通知新成就
        for (let achievement of achievements) {
            this.provideFeedback(`🏆 获得成就: ${achievement.name} - ${achievement.description}`);
        }
    }
    
    provideFeedback(message) {
        this.feedback.lastMessage = message;
        this.feedback.messageTime = Date.now();
        
        console.log('反馈:', message);
        
        if (this.callbacks.onFeedback) {
            this.callbacks.onFeedback(message);
        }
    }
    
    
    generateSessionReport() {
        if (this.sessionData.length === 0) return null;
        
        const sessionDuration = Date.now() - this.sessionStartTime;
        const averageMetrics = this.calculateAverageMetrics();
        const improvements = this.calculateSessionImprovements();
        
        const report = {
            duration: sessionDuration,
            mode: this.currentMode,
            averageMetrics,
            improvements,
            achievements: [...this.feedback.achievements],
            dataPoints: this.sessionData.length,
            sessionLength: sessionDuration
        };
        
        console.log('会话报告:', report);
        return report;
    }
    
    calculateAverageMetrics() {
        if (this.sessionData.length === 0) return null;
        
        const totals = { stress: 0, attention: 0, relaxation: 0 };
        
        for (let data of this.sessionData) {
            totals.stress += data.metrics.stress;
            totals.attention += data.metrics.attention;
            totals.relaxation += data.metrics.relaxation;
        }
        
        return {
            stress: totals.stress / this.sessionData.length,
            attention: totals.attention / this.sessionData.length,
            relaxation: totals.relaxation / this.sessionData.length
        };
    }
    
    calculateSessionImprovements() {
        if (this.sessionData.length < 2) return null;
        
        const firstData = this.sessionData[0];
        const lastData = this.sessionData[this.sessionData.length - 1];
        
        return {
            stress: firstData.metrics.stress - lastData.metrics.stress,
            attention: lastData.metrics.attention - firstData.metrics.attention,
            relaxation: lastData.metrics.relaxation - firstData.metrics.relaxation
        };
    }
    
    getProgress() {
        return { ...this.progress };
    }
    
    getCurrentMode() {
        return this.currentMode;
    }
    
}