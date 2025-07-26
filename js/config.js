// Emotiv Cortex API 配置文件
// 请将你的实际凭证填入下方
const EMOTIV_CONFIG = {
    // 在 https://account.emotiv.com/my-account/cortex-apps/ 获取
    CLIENT_ID: "hsuAsl0zR8WroB4a8N0dR0z0SDSkhx09Pjn7F9p7",
    CLIENT_SECRET: "FjFvZMoeK09qjA7E0BxcjRayfgDDX9KZAgLJ5RMIbbxe0ukDAIPHfSt1ftdCXJt2v2xCpWl1Xfduv6coHgrtdLKTUMdvjqSlSH1KfdCf5wsM8XjTWJdc7WnshC5ojLsn",
    
    // License 通常可以留空，Emotiv Cloud 会自动分配
    LICENSE: "",
    
    // 其他配置选项
    DEBIT: 1,
    
    // WebSocket 连接配置
    WEBSOCKET_URL: "wss://localhost:6868",
    
    // 游戏设置
    GAME_SETTINGS: {
        // 数据更新频率 (毫秒)
        UPDATE_INTERVAL: 100,
        
        // 视觉效果设置
        MAX_PARTICLES: 100,
        WAVE_COUNT: 5,
        
        // 正念训练目标
        TARGET_STRESS_LEVEL: 0.3,      // 目标压力水平 (0-1)
        TARGET_ATTENTION_LEVEL: 0.7,   // 目标注意力水平 (0-1)
        TARGET_RELAXATION_LEVEL: 0.8,  // 目标放松度 (0-1)
        
    }
};

// 验证配置
function validateConfig() {
    const warnings = [];
    
    if (EMOTIV_CONFIG.CLIENT_ID === "your_client_id_here") {
        warnings.push("⚠️ CLIENT_ID 尚未设置，请在 config.js 中填入你的实际 Client ID");
    }
    
    if (EMOTIV_CONFIG.CLIENT_SECRET === "your_client_secret_here") {
        warnings.push("⚠️ CLIENT_SECRET 尚未设置，请在 config.js 中填入你的实际 Client Secret");
    }
    
    if (warnings.length > 0) {
        console.warn("配置检查：");
        warnings.forEach(warning => console.warn(warning));
        console.warn("请访问 https://account.emotiv.com/my-account/cortex-apps/ 获取你的开发者凭证");
    } else {
        console.log("✅ 配置检查通过");
    }
    
    return warnings.length === 0;
}

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 环境
    module.exports = { EMOTIV_CONFIG, validateConfig };
}