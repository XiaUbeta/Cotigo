class CortexClient {
    constructor() {
        this.socket = null;
        this.user = null;
        this.authToken = null;
        this.sessionId = null;
        this.headsetId = null;
        this.isConnected = false;
        this.isHeadsetConnected = false;
        this.callbacks = {
            onConnectionChange: null,
            onHeadsetChange: null,
            onSessionChange: null,
            onMetricsData: null,
            onError: null
        };
        
        // Request IDs
        this.REQUEST_IDS = {
            REQUEST_ACCESS: 1,
            QUERY_HEADSET: 2,
            CONTROL_DEVICE: 3,
            AUTHORIZE: 4,
            CREATE_SESSION: 5,
            SUBSCRIBE: 6
        };
    }

    setCallback(event, callback) {
        if (this.callbacks.hasOwnProperty('on' + event.charAt(0).toUpperCase() + event.slice(1))) {
            this.callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)] = callback;
        }
    }

    connect(user) {
        return new Promise((resolve, reject) => {
            try {
                this.user = user;
                this.socket = new WebSocket('wss://localhost:6868');
                
                this.socket.onopen = () => {
                    console.log('WebSocket 连接已建立');
                    this.isConnected = true;
                    if (this.callbacks.onConnectionChange) {
                        this.callbacks.onConnectionChange(true);
                    }
                    resolve();
                };

                this.socket.onclose = () => {
                    console.log('WebSocket 连接已关闭');
                    this.isConnected = false;
                    this.isHeadsetConnected = false;
                    if (this.callbacks.onConnectionChange) {
                        this.callbacks.onConnectionChange(false);
                    }
                    if (this.callbacks.onHeadsetChange) {
                        this.callbacks.onHeadsetChange(false);
                    }
                };

                this.socket.onerror = (error) => {
                    console.error('WebSocket 错误:', error);
                    if (this.callbacks.onError) {
                        this.callbacks.onError('WebSocket 连接失败');
                    }
                    reject(error);
                };

                this.socket.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            // 调试：打印所有接收到的消息（但过滤掉过于频繁的数据流）
            if (!message.met && !message.eeg && !message.pow) {
                console.log('收到消息:', message);
            }
            
            // 处理性能指标数据流消息
            if (message.met) {
                console.log('收到性能指标数据流消息，完整结构:', message);
                this.handleMetricsData(message.met);
                return;
            }

            // 处理其他数据流（用于调试）
            if (message.eeg) {
                console.log('收到 EEG 数据流（已忽略）');
                return;
            }
            
            if (message.pow) {
                console.log('收到功率谱数据流（已忽略）');
                return;
            }

            // 处理 API 响应
            if (message.id) {
                this.handleApiResponse(message);
            }

            // 处理警告消息
            if (message.warning) {
                console.log('收到警告:', message.warning);
            }

        } catch (error) {
            console.error('消息解析错误:', error);
            console.log('原始数据:', data);
        }
    }

    handleMetricsData(metricsArray) {
        // 调试：打印原始数据结构
        console.log('原始性能指标数据:', metricsArray);
        
        if (!Array.isArray(metricsArray)) {
            console.warn('性能指标数据不是数组格式:', typeof metricsArray);
            return;
        }
        
        if (metricsArray.length < 3) {
            console.warn('性能指标数据长度不足:', metricsArray.length);
            return;
        }

        // 使用专门的混合格式解析器
        const metrics = this.parseMixedMetricsFormat(metricsArray);
        
        console.log('最终处理后的指标:', metrics);

        if (this.callbacks.onMetricsData) {
            this.callbacks.onMetricsData(metrics);
        }
    }
    
    // 解析混合格式的性能指标数据
    parseMixedMetricsFormat(metricsArray) {
        console.log('使用混合格式解析器');
        
        // 从你的数据样本：[true, 0.7, true, 0.35, true, 0.8, 0, true, 0.35, true, 0.25, true, 0.2]
        // 模式分析：布尔值和数值交替出现，中间有一个单独的0
        
        // 提取所有数值（过滤掉布尔值）
        const numericValues = metricsArray.filter(value => typeof value === 'number');
        console.log('提取的数值:', numericValues);
        
        const metrics = {
            attention: numericValues[0] !== undefined ? numericValues[0] : 0,      // 0.7 - 注意力
            engagement: numericValues[1] !== undefined ? numericValues[1] : 0,         // 0.35 - 压力
            excitement: numericValues[2] !== undefined ? numericValues[2] : 0,     // 0.8 - 兴奋度（原relaxation位置）
            // 跳过索引3的0（分隔符）
            stress: numericValues[4] !== undefined ? numericValues[4] : 0,     // 0.35 - 参与度
            relaxation: numericValues[5] !== undefined ? numericValues[5] : 0,     // 0.25 - 放松度（原meditation位置）
            interest: numericValues[6] !== undefined ? numericValues[6] : 0        // 0.2 - 兴趣度（原excitement位置）
        };
        
        console.log('混合格式解析结果:', metrics);
        
        // 标准化所有数值
        return {
            stress: this.normalizeValue(metrics.stress),
            attention: this.normalizeValue(metrics.attention),
            relaxation: this.normalizeValue(metrics.relaxation),
            engagement: this.normalizeValue(metrics.engagement),
            excitement: this.normalizeValue(metrics.excitement),
            interest: this.normalizeValue(metrics.interest),
            timestamp: Date.now()
        };
    }
    
    // 检测数据格式
    detectDataFormat(metricsArray) {
        console.log('数据格式检测 - 输入数组:', metricsArray);
        console.log('第一个元素:', metricsArray[0], '类型:', typeof metricsArray[0]);
        
        // 简单的启发式检测：如果第一个值看起来像时间戳，则是 V2 格式
        if (metricsArray.length > 0 && typeof metricsArray[0] === 'number' && metricsArray[0] > 1000000000) {
            console.log('检测为 V2 格式（带时间戳）');
            return true; // V2 格式（带时间戳）
        }
        console.log('检测为 V1 格式（直接指标值）');
        return false; // V1 格式（直接指标值）
    }
    
    // V1 格式解析（直接指标值）
    parseMetricsV1(metricsArray) {
        console.log('使用 V1 格式解析（直接指标值）');
        console.log('V1 解析 - 数组内容:', metricsArray);
        
        const result = {
            stress: metricsArray[0] !== undefined ? metricsArray[0] : 0,
            attention: metricsArray[1] !== undefined ? metricsArray[1] : 0,
            relaxation: metricsArray[2] !== undefined ? metricsArray[2] : 0,
            engagement: metricsArray[3] !== undefined ? metricsArray[3] : 0,
            excitement: metricsArray[4] !== undefined ? metricsArray[4] : 0,
            meditation: metricsArray[5] !== undefined ? metricsArray[5] : 0
        };
        
        console.log('V1 解析结果:', result);
        return result;
    }
    
    // V2 格式解析（带时间戳）
    parseMetricsV2(metricsArray) {
        console.log('使用 V2 格式解析（带时间戳）');
        console.log('V2 解析 - 数组内容:', metricsArray);
        
        // [时间戳, 参与度, 兴奋度, 长期兴奋度, 压力, 放松度, 注意力, 冥想]
        const result = {
            timestamp: metricsArray[0],
            engagement: metricsArray[1] !== undefined ? metricsArray[1] : 0,
            excitement: metricsArray[2] !== undefined ? metricsArray[2] : 0,
            longTermExcitement: metricsArray[3] !== undefined ? metricsArray[3] : 0,
            stress: metricsArray[4] !== undefined ? metricsArray[4] : 0,
            relaxation: metricsArray[5] !== undefined ? metricsArray[5] : 0,
            attention: metricsArray[6] !== undefined ? metricsArray[6] : 0,
            meditation: metricsArray[7] !== undefined ? metricsArray[7] : 0
        };
        
        console.log('V2 解析结果:', result);
        return result;
    }
    
    // 数值标准化
    normalizeValue(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return 0;
        }
        
        // 确保是数值类型
        if (typeof value !== 'number') {
            const parsed = parseFloat(value);
            if (isNaN(parsed)) {
                return 0;
            }
            value = parsed;
        }
        
        // 如果值已经在 0-1 范围内，直接返回
        if (value >= 0 && value <= 1) {
            return value;
        }
        
        // 如果是百分比形式（0-100），转换为 0-1
        if (value >= 0 && value <= 100) {
            return value / 100;
        }
        
        // 其他情况，限制在 0-1 范围
        return Math.max(0, Math.min(1, value));
    }

    handleApiResponse(message) {
        // 这里可以添加对特定 API 响应的处理
        console.log('API 响应:', message);
    }

    async initializeSession() {
        try {
            // 1. 请求访问权限
            await this.requestAccess();
            
            // 2. 查询头戴设备
            await this.queryHeadsets();
            
            // 3. 连接设备
            if (this.headsetId) {
                await this.controlDevice(this.headsetId);
            }
            
            // 4. 授权获取令牌
            await this.authorize();
            
            // 5. 创建会话
            await this.createSession();
            
            return true;
        } catch (error) {
            console.error('初始化会话失败:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError('初始化失败: ' + error.message);
            }
            throw error;
        }
    }

    requestAccess() {
        return new Promise((resolve, reject) => {
            const request = {
                jsonrpc: "2.0",
                method: "requestAccess",
                params: {
                    clientId: this.user.clientId,
                    clientSecret: this.user.clientSecret
                },
                id: this.REQUEST_IDS.REQUEST_ACCESS
            };

            this.sendRequest(request, (response) => {
                if (response.error) {
                    reject(new Error(response.error.message));
                } else if (response.result.accessGranted) {
                    resolve(response.result);
                } else {
                    reject(new Error('需要在 EMOTIV Launcher 中手动授权访问'));
                }
            });
        });
    }

    queryHeadsets() {
        return new Promise((resolve, reject) => {
            const request = {
                jsonrpc: "2.0",
                method: "queryHeadsets",
                params: {},
                id: this.REQUEST_IDS.QUERY_HEADSET
            };

            this.sendRequest(request, (response) => {
                if (response.error) {
                    reject(new Error(response.error.message));
                } else {
                    const headsets = response.result;
                    if (headsets.length > 0) {
                        // 查找已连接的设备
                        const connectedHeadset = headsets.find(h => h.status === 'connected');
                        if (connectedHeadset) {
                            this.headsetId = connectedHeadset.id;
                            this.isHeadsetConnected = true;
                            if (this.callbacks.onHeadsetChange) {
                                this.callbacks.onHeadsetChange(true, connectedHeadset);
                            }
                        }
                        resolve(headsets);
                    } else {
                        reject(new Error('未找到头戴设备'));
                    }
                }
            });
        });
    }

    controlDevice(headsetId) {
        return new Promise((resolve, reject) => {
            const request = {
                jsonrpc: "2.0",
                method: "controlDevice",
                params: {
                    command: "connect",
                    headset: headsetId
                },
                id: this.REQUEST_IDS.CONTROL_DEVICE
            };

            this.sendRequest(request, (response) => {
                if (response.error) {
                    reject(new Error(response.error.message));
                } else {
                    resolve(response.result);
                }
            });
        });
    }

    authorize() {
        return new Promise((resolve, reject) => {
            const request = {
                jsonrpc: "2.0",
                method: "authorize",
                params: {
                    clientId: this.user.clientId,
                    clientSecret: this.user.clientSecret,
                    license: this.user.license || "",
                    debit: this.user.debit || 1
                },
                id: this.REQUEST_IDS.AUTHORIZE
            };

            this.sendRequest(request, (response) => {
                if (response.error) {
                    reject(new Error(response.error.message));
                } else {
                    this.authToken = response.result.cortexToken;
                    resolve(this.authToken);
                }
            });
        });
    }

    createSession() {
        return new Promise((resolve, reject) => {
            const request = {
                jsonrpc: "2.0",
                method: "createSession",
                params: {
                    cortexToken: this.authToken,
                    headset: this.headsetId,
                    status: "active"
                },
                id: this.REQUEST_IDS.CREATE_SESSION
            };

            this.sendRequest(request, (response) => {
                if (response.error) {
                    reject(new Error(response.error.message));
                } else {
                    this.sessionId = response.result.id;
                    if (this.callbacks.onSessionChange) {
                        this.callbacks.onSessionChange(true, this.sessionId);
                    }
                    resolve(this.sessionId);
                }
            });
        });
    }

    subscribeToMetrics() {
        return new Promise((resolve, reject) => {
            if (!this.authToken || !this.sessionId) {
                reject(new Error('需要先建立会话'));
                return;
            }

            const request = {
                jsonrpc: "2.0",
                method: "subscribe",
                params: {
                    cortexToken: this.authToken,
                    session: this.sessionId,
                    streams: ["met"] // 订阅性能指标数据流
                },
                id: this.REQUEST_IDS.SUBSCRIBE
            };

            this.sendRequest(request, (response) => {
                if (response.error) {
                    reject(new Error(response.error.message));
                } else {
                    console.log('成功订阅性能指标数据流');
                    resolve(response.result);
                }
            });
        });
    }

    sendRequest(request, callback) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket 未连接');
        }

        // 注册回调
        const originalOnMessage = this.socket.onmessage;
        this.socket.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);
                if (response.id === request.id) {
                    callback(response);
                    this.socket.onmessage = originalOnMessage; // 恢复原始处理器
                } else {
                    // 如果不是我们期望的响应，继续使用原始处理器
                    if (originalOnMessage) {
                        originalOnMessage(event);
                    }
                }
            } catch (error) {
                console.error('响应解析错误:', error);
            }
        };

        this.socket.send(JSON.stringify(request));
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.authToken = null;
        this.sessionId = null;
        this.headsetId = null;
        this.isConnected = false;
        this.isHeadsetConnected = false;
    }
}