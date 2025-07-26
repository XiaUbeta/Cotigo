class MindfulnessApp {
    constructor() {
        this.cortexClient = new CortexClient();
        this.visualEngine = new VisualEngine('visualCanvas', 'fluidCanvas');
        this.mindfulnessGame = new MindfulnessGame();
        
        this.isConnected = false;
        this.isSessionActive = false;
        this.currentMetrics = { stress: 0, attention: 0, relaxation: 0 };
        
        // 从配置文件读取开发者凭证
        this.defaultCredentials = {
            clientId: EMOTIV_CONFIG.CLIENT_ID,
            clientSecret: EMOTIV_CONFIG.CLIENT_SECRET,
            license: EMOTIV_CONFIG.LICENSE
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupCallbacks();
        this.updateUI();
        
        // 启动视觉引擎
        this.visualEngine.start();
        
        console.log('星云粒子冥想体验已初始化');
        
        // 验证配置
        validateConfig();
    }
    
    setupEventListeners() {
        // 连接按钮
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.handleConnect();
        });
        
        // 开始体验按钮
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.handleStartGame();
        });
        
        
    }
    
    setupCallbacks() {
        // Cortex 客户端回调
        this.cortexClient.setCallback('connectionChange', (connected) => {
            this.isConnected = connected;
            this.updateConnectionStatus(connected);
            this.updateUI();
        });
        
        this.cortexClient.setCallback('headsetChange', (connected, headset) => {
            this.updateHeadsetStatus(connected, headset);
            this.updateUI();
        });
        
        this.cortexClient.setCallback('sessionChange', (active, sessionId) => {
            this.isSessionActive = active;
            this.updateSessionStatus(active, sessionId);
            this.updateUI();
        });
        
        this.cortexClient.setCallback('metricsData', (metrics) => {
            this.handleMetricsUpdate(metrics);
        });
        
        this.cortexClient.setCallback('error', (error) => {
            this.showError(error);
        });
        
        // 正念游戏回调
        this.mindfulnessGame.setCallback('modeChange', (mode) => {
            this.handleGameModeChange(mode);
        });
        
        this.mindfulnessGame.setCallback('progressUpdate', (progress) => {
            this.updateProgressDisplay(progress);
        });
        
        
        this.mindfulnessGame.setCallback('feedback', (message) => {
            this.showFeedback(message);
        });
    }
    
    validateCredentials() {
        const isValid = this.defaultCredentials.clientId.length > 0 && 
                       this.defaultCredentials.clientSecret.length > 0 && 
                       this.defaultCredentials.clientId !== "your_client_id_here" && 
                       this.defaultCredentials.clientSecret !== "your_client_secret_here";
        
        return isValid;
    }
    
    async handleConnect() {
        if (!this.validateCredentials()) {
            this.showError('开发者凭证配置无效，请检查 config.js 文件');
            return;
        }
        
        // 直接使用配置文件中的凭证
        const user = {
            clientId: this.defaultCredentials.clientId,
            clientSecret: this.defaultCredentials.clientSecret,
            license: this.defaultCredentials.license,
            debit: 1
        };
        
        try {
            this.showStatus('正在连接到 Cortex 服务...');
            
            // 连接到 Cortex
            await this.cortexClient.connect(user);
            
            this.showStatus('正在初始化会话...');
            
            // 初始化会话
            await this.cortexClient.initializeSession();
            
            this.showStatus('连接成功！');
            
        } catch (error) {
            console.error('连接失败:', error);
            this.showError('连接失败: ' + error.message);
        }
    }
    
    async handleStartGame() {
        if (!this.isSessionActive) {
            this.showError('请先连接头戴设备');
            return;
        }
        
        try {
            // 订阅性能指标数据流
            await this.cortexClient.subscribeToMetrics();
            
            // 启动单一星云模式体验
            this.mindfulnessGame.startMeditationMode();
            
            // 启动呼吸引导
            this.visualEngine.startBreathingGuide();
            
            // 更新UI状态
            this.updateUI();
            
            this.showStatus('星云冥想体验已开始');
            
            // 显示冥想帮助提示
            const meditationHelper = document.getElementById('meditationHelper');
            if (meditationHelper) {
                meditationHelper.classList.add('active');
                setTimeout(() => {
                    meditationHelper.classList.remove('active');
                }, 6000);
            }
            
            // 显示会话进度计时器
            const sessionProgress = document.getElementById('sessionProgress');
            if (sessionProgress) {
                sessionProgress.classList.add('active');
            }
            
            
        } catch (error) {
            console.error('启动体验失败:', error);
            this.showError('启动体验失败: ' + error.message);
        }
    }
    
    
    
    handleMetricsUpdate(metrics) {
        this.currentMetrics = metrics;
        
        // 更新视觉引擎
        this.visualEngine.updateMetrics(metrics);
        
        // 更新正念游戏
        this.mindfulnessGame.updateMetrics(metrics);
        
        // 更新指标显示
        this.updateMetricsDisplay(metrics);
    }
    
    handleGameModeChange(mode) {
        console.log('游戏模式切换到:', mode);
    }
    
    
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span:last-child');
        
        if (connected) {
            indicator.className = 'status-indicator status-connected';
            text.textContent = '已连接';
        } else {
            indicator.className = 'status-indicator status-disconnected'; 
            text.textContent = '未连接';
        }
    }
    
    updateHeadsetStatus(connected, headset) {
        const statusElement = document.getElementById('headsetStatus');
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span:last-child');
        
        if (connected) {
            indicator.className = 'status-indicator status-connected';
            text.textContent = headset ? `已连接: ${headset.id}` : '已连接';
        } else {
            indicator.className = 'status-indicator status-disconnected';
            text.textContent = '未检测到设备';
        }
    }
    
    updateSessionStatus(active, sessionId) {
        const statusElement = document.getElementById('sessionStatus');
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span:last-child');
        
        if (active) {
            indicator.className = 'status-indicator status-connected';
            text.textContent = '会话活跃';
        } else {
            indicator.className = 'status-indicator status-disconnected';
            text.textContent = '无会话';
        }
    }
    
    updateMetricsDisplay(metrics) {
        // 更新悬浮指标圆点
        const stressIndicator = document.getElementById('stressIndicator');
        const attentionIndicator = document.getElementById('attentionIndicator');
        const relaxationIndicator = document.getElementById('relaxationIndicator');
        
        if (stressIndicator && attentionIndicator && relaxationIndicator) {
            // 压力越大，圆点越大
            stressIndicator.style.transform = `scale(${1 + metrics.stress * 1.5})`;
            stressIndicator.style.opacity = 0.3 + metrics.stress * 0.7;
            
            // 注意力越高，圆点越亮
            attentionIndicator.style.transform = `scale(${1 + metrics.attention * 1.5})`;
            attentionIndicator.style.opacity = 0.3 + metrics.attention * 0.7;
            
            // 放松度越高，圆点越亮
            relaxationIndicator.style.transform = `scale(${1 + metrics.relaxation * 1.5})`;
            relaxationIndicator.style.opacity = 0.3 + metrics.relaxation * 0.7;
        }
    }
    
    updateProgressDisplay(progress) {
        // 更新进度显示逻辑
        console.log('进度更新:', progress);
        
        // 更新会话进度指示器
        const sessionProgress = document.getElementById('sessionProgress');
        const sessionTimer = document.getElementById('sessionTimer');
        
        if (sessionProgress && sessionTimer) {
            if (progress && progress.sessionTime) {
                // 显示会话计时器
                sessionProgress.classList.add('active');
                
                // 计算分钟和秒
                const minutes = Math.floor(progress.sessionTime / 60);
                const seconds = Math.floor(progress.sessionTime % 60);
                
                // 格式化时间 (MM:SS)
                const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                sessionTimer.textContent = formattedTime;
            } else {
                // 隐藏会话计时器
                sessionProgress.classList.remove('active');
            }
        }
    }
    
    updateUI() {
        const connectBtn = document.getElementById('connectBtn');
        const startGameBtn = document.getElementById('startGameBtn');
        
        // 更新按钮状态  
        const gameMode = this.mindfulnessGame.getCurrentMode();
        
        connectBtn.disabled = this.isConnected || !this.validateCredentials();
        startGameBtn.disabled = !this.isSessionActive || gameMode !== 'idle';
        
        // 更新按钮样式
        startGameBtn.classList.toggle('active', gameMode !== 'idle');
        
        // 更新连接按钮文本
        connectBtn.textContent = this.isConnected ? '已连接' : '🔗';
    }
    
    
    showStatus(message) {
        console.log('状态:', message);
        // 这里可以添加状态显示逻辑，比如临时显示一个通知
        this.showTemporaryMessage(message, 'info');
    }
    
    showError(message) {
        console.error('错误:', message);
        this.showTemporaryMessage(message, 'error');
        
        // 显示连接帮助提示
        if (message.includes('连接') || message.includes('设备')) {
            const connectHelper = document.getElementById('connectHelper');
            if (connectHelper) {
                connectHelper.classList.add('active');
                setTimeout(() => {
                    connectHelper.classList.remove('active');
                }, 8000);
            }
        }
    }
    
    showFeedback(message) {
        console.log('反馈:', message);
        this.showTemporaryMessage(message, 'feedback');
    }
    
    showTemporaryMessage(message, type) {
        // 使用现有的状态消息元素，避免创建临时元素
        const statusMessage = document.getElementById('statusMessage');
        
        if (statusMessage) {
            // 根据消息类型设置样式
            statusMessage.className = 'status-message active';
            
            if (type === 'error') {
                statusMessage.style.background = 'rgba(244, 67, 54, 0.8)';
                statusMessage.style.borderColor = 'rgba(244, 67, 54, 0.3)';
            } else if (type === 'feedback') {
                statusMessage.style.background = 'rgba(76, 175, 80, 0.8)';
                statusMessage.style.borderColor = 'rgba(76, 175, 80, 0.3)';
            } else {
                statusMessage.style.background = 'rgba(33, 150, 243, 0.8)';
                statusMessage.style.borderColor = 'rgba(33, 150, 243, 0.3)';
            }
            
            statusMessage.textContent = message;
            
            // 自动隐藏
            setTimeout(() => {
                statusMessage.classList.remove('active');
                
                // 重置样式
                setTimeout(() => {
                    statusMessage.style.background = '';
                    statusMessage.style.borderColor = '';
                }, 300);
            }, type === 'error' ? 5000 : 3000);
            
            return;
        }
        
        // 回退方案：创建临时消息元素
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? 'rgba(244, 67, 54, 0.8)' : 
                        type === 'feedback' ? 'rgba(76, 175, 80, 0.8)' : 
                        'rgba(33, 150, 243, 0.8)'};
            color: white;
            padding: 12px 24px;
            border-radius: var(--border-radius-md, 12px);
            backdrop-filter: blur(10px);
            z-index: 1000;
            font-size: 14px;
            max-width: 80%;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: messageSlideIn 0.3s ease-out;
            border: 1px solid ${type === 'error' ? 'rgba(244, 67, 54, 0.3)' : 
                              type === 'feedback' ? 'rgba(76, 175, 80, 0.3)' : 
                              'rgba(33, 150, 243, 0.3)'};
        `;
        
        messageElement.textContent = message;
        document.body.appendChild(messageElement);
        
        // 自动移除消息
        setTimeout(() => {
            messageElement.style.animation = 'messageSlideOut 0.3s ease-in';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }, type === 'error' ? 5000 : 3000);
    }
    
    // 应用关闭时的清理
    cleanup() {
        this.cortexClient.disconnect();
    }
}

// 添加 CSS 动画
const style = document.createElement('style');
style.textContent = `
    @keyframes messageSlideIn {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    
    @keyframes messageSlideOut {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
    }
    
    .btn.active {
        background: rgba(139, 92, 246, 0.5);
        box-shadow: 0 0 15px rgba(139, 92, 246, 0.6);
    }
`;
document.head.appendChild(style);

// 初始化应用
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new MindfulnessApp();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (app) {
        app.cleanup();
    }
});