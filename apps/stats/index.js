const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// 统计数据文件路径
const statsFile = path.join(dataDir, 'stats.json');
const blacklistFile = path.join(__dirname, '../../config/blacklist.json');

class StatsManager {
    constructor() {
        // 初始化统计文件
        if (!fs.existsSync(statsFile)) {
            fs.writeFileSync(statsFile, JSON.stringify({ monthlyStats: {} }, null, 2));
        }

        // 当前月份key
        this.currentMonthKey = this.getMonthKey();
        
        // 每小时检查月份变化
        setInterval(() => this.checkMonthChange(), 3600000);
    }

    // 获取当前月份key (格式: YYYY-MM)
    getMonthKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // 检查月份变化
    checkMonthChange() {
        const newMonthKey = this.getMonthKey();
        if (newMonthKey !== this.currentMonthKey) {
            this.currentMonthKey = newMonthKey;
        }
    }

    // 加载统计数据
    loadStats() {
        try {
            const data = fs.readFileSync(statsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('加载统计文件失败:', error);
            return { monthlyStats: {} };
        }
    }

    // 保存统计数据
    saveStats(stats) {
        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    }

    // 加载黑名单
    loadBlacklist() {
        try {
            const data = fs.readFileSync(blacklistFile, 'utf8');
            return JSON.parse(data).qq_blacklist || [];
        } catch (error) {
            console.error('加载黑名单失败:', error);
            return [];
        }
    }

    // 保存黑名单
    saveBlacklist(blacklist) {
        const data = { qq_blacklist: blacklist };
        fs.writeFileSync(blacklistFile, JSON.stringify(data, null, 2));
    }

    // 记录QQ请求
    async recordQQRequest(qq) {
        try {
            // 检查是否在黑名单
            const blacklist = this.loadBlacklist();
            if (blacklist.includes(qq)) {
                throw new Error('QQ号已被列入黑名单');
            }

            // 记录QQ使用次数
            const stats = this.loadStats();
            if (!stats.monthlyStats[this.currentMonthKey]) {
                stats.monthlyStats[this.currentMonthKey] = {};
            }
            
            stats.monthlyStats[this.currentMonthKey][qq] = 
                (stats.monthlyStats[this.currentMonthKey][qq] || 0) + 1;
            
            this.saveStats(stats);
            return true;
        } catch (error) {
            console.error('记录QQ请求时出错:', error);
            throw error;
        }
    }

    // 添加QQ到黑名单
    async addToBlacklist(qq) {
        const blacklist = this.loadBlacklist();
        if (!blacklist.includes(qq)) {
            blacklist.push(qq);
            this.saveBlacklist(blacklist);
        }
    }

    // 从黑名单移除QQ
    async removeFromBlacklist(qq) {
        const blacklist = this.loadBlacklist();
        const index = blacklist.indexOf(qq);
        if (index !== -1) {
            blacklist.splice(index, 1);
            this.saveBlacklist(blacklist);
        }
    }

    // 获取QQ统计
    async getQQStats(qq) {
        const stats = this.loadStats();
        const blacklist = this.loadBlacklist();
        
        const monthlyUsage = stats.monthlyStats[this.currentMonthKey]?.[qq] || 0;
        const isBlacklisted = blacklist.includes(qq);
        
        return {
            qq,
            monthlyUsage,
            isBlacklisted
        };
    }

    // 获取当月所有QQ统计
    async getAllQQStats() {
        const stats = this.loadStats();
        const blacklist = this.loadBlacklist();
        
        const monthlyStats = stats.monthlyStats[this.currentMonthKey] || {};
        return Object.entries(monthlyStats).map(([qq, count]) => ({
            qq,
            count,
            isBlacklisted: blacklist.includes(qq)
        }));
    }

    // 记录请求成功
    async recordSuccess(type = 'general', qq = null) {
        try {
            if (qq) {
                await this.recordQQRequest(qq);
            }
            return true;
        } catch (error) {
            console.error('记录成功请求时出错:', error);
            throw error;
        }
    }

    // 记录请求失败
    async recordFailure(type = 'general', qq = null) {
        try {
            if (qq) {
                await this.recordQQRequest(qq);
            }
            return true;
        } catch (error) {
            console.error('记录失败请求时出错:', error);
            throw error;
        }
    }
}

// 创建单例实例
const statsManager = new StatsManager();

module.exports = statsManager;