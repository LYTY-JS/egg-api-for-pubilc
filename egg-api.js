const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { processImage } = require('./apps/imageProcessor');
const { processGif } = require('./apps/gifProcessor');
const statsManager = require('./apps/stats');

const app = express();
const port = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 请求日志中间件
app.use(async (req, res, next) => {
    // 从请求头或查询参数中获取QQ号
    const qq = req.headers['x-qq-number'] || req.query.qq;
    const type = req.path.includes('process-gif') ? 'gif' : 
                req.path.includes('process-image') ? 'image' : 'general';

    // 拦截响应完成事件
    res.on('finish', () => {
        const success = res.statusCode >= 200 && res.statusCode < 400;
        
        try {
            if (success) {
                statsManager.recordSuccess(type, qq);
            } else {
                statsManager.recordFailure(type, qq);
            }
        } catch (error) {
            console.error('记录统计时出错:', error);
        }
    });

    next();
});

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || '服务器内部错误',
            status: err.status || 500
        }
    });
};

// 输入验证中间件
const validateImageUrls = (req, res, next) => {
    const { imageUrl, replacementImageUrl } = req.body;
    
    if (!imageUrl) {
        return res.status(400).json({ error: '缺少 imageUrl 参数' });
    }

    if (!replacementImageUrl && replacementImageUrl !== 'replace') {
        return res.status(400).json({ error: '缺少 replacementImageUrl 参数' });
    }

    next();
};

// 路由处理
app.post('/process-image', validateImageUrls, async (req, res) => {
    try {
        const { imageUrl, replacementImageUrl } = req.body;
        const classifiersFolder = path.join(__dirname, 'classifiers');
        
        const { outputPath, tempFiles } = await processImage(
            imageUrl, 
            replacementImageUrl, 
            classifiersFolder
        );

        // 读取处理后的图片
        const processedImage = fs.readFileSync(outputPath);
        
        // 清理临时文件
        tempFiles.forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': processedImage.length
        });
        res.end(processedImage);

    } catch (error) {
        next(error);
    }
});

app.post('/process-gif', validateImageUrls, async (req, res) => {
    try {
        const { imageUrl, replacementImageUrl } = req.body;
        const classifiersFolder = path.join(__dirname, 'classifiers');
        
        const { outputPath, tempFiles } = await processGif(
            imageUrl, 
            replacementImageUrl, 
            classifiersFolder
        );

        // 读取处理后的GIF
        const processedGif = fs.readFileSync(outputPath);
        
        // 清理临时文件
        tempFiles.forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });

        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': processedGif.length
        });
        res.end(processedGif);

    } catch (error) {
        next(error);
    }
});

// 统计接口
app.get('/stats', async (req, res) => {
    try {
        const stats = await statsManager.getAllQQStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

// 统计管理接口
app.get('/tongji', async (req, res) => {
    try {
        const stats = await statsManager.getAllQQStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

app.post('/tongji/blacklist', async (req, res) => {
    try {
        const { qq } = req.body;
        if (!qq) {
            return res.status(400).json({ error: '缺少QQ参数' });
        }
        await statsManager.addToBlacklist(qq);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

app.delete('/tongji/blacklist/:qq', async (req, res) => {
    try {
        const { qq } = req.params;
        await statsManager.removeFromBlacklist(qq);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// 注册错误处理中间件
app.use(errorHandler);

// 启动服务器
app.listen(port, async () => {
    console.log(`服务器运行在 http://localhost:${port}`);
    console.log('支持的接口:');
    console.log('- POST /process-image');
    console.log('- POST /process-gif');
    console.log('- GET /stats');
    console.log('- GET /tongji');
    console.log('- POST /tongji/blacklist');
    console.log('- DELETE /tongji/blacklist/:qq');
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，准备关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，准备关闭服务器...');
    process.exit(0);
});