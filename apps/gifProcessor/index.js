const cv = require('@u4/opencv4nodejs');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const axios = require('axios');
const { loadClassifiersFromFolder } = require('../imageProcessor');

// GIF 转换为视频
async function gifToVideo(inputGifPath, outputVideoPath) {
    console.log('开始将GIF转换为视频...');
    return new Promise((resolve, reject) => {
        ffmpeg(inputGifPath)
            .inputFormat('gif')
            .output(outputVideoPath)
            .on('start', (commandLine) => {
                console.log('FFmpeg 命令:', commandLine);
            })
            .on('end', () => {
                console.log('GIF成功转换为视频:', outputVideoPath);
                resolve();
            })
            .on('error', (err) => {
                console.error('GIF转换为视频时出错:', err);
                reject(err);
            })
            .run();
    });
}

// 视频转换为 GIF
async function videoToGif(inputVideoPath, outputGifPath) {
    console.log('开始将视频转换为GIF...');
    return new Promise((resolve, reject) => {
        ffmpeg(inputVideoPath)
            .output(outputGifPath)
            .on('start', (commandLine) => {
                console.log('FFmpeg 命令:', commandLine);
            })
            .on('end', () => {
                console.log('视频成功转换为GIF:', outputGifPath);
                resolve();
            })
            .on('error', (err) => {
                console.error('视频转换为GIF时出错:', err);
                reject(err);
            })
            .run();
    });
}

// 处理GIF文件
async function processGif(gifUrl, replacementImageUrl, classifiersFolder) {
    const tempDir = os.tmpdir();
    const tempGifPath = path.join(tempDir, 'temp.gif');
    const tempGifPaths = path.join(tempDir, 'temps.gif');
    const tempVideoPath = path.join(tempDir, 'temp_video.mp4');
    const outputVideoPath = path.join(tempDir, 'out.mp4');
    const outputGifPath = path.join(tempDir, 'output.gif');

    const tempFiles = [tempGifPath, tempGifPaths, tempVideoPath, outputVideoPath, outputGifPath];

    try {
        console.log('开始下载GIF...');
        const response = await axios.get(gifUrl, { responseType: 'stream' });
        const writer = fs.createWriteStream(tempGifPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        let replacementImageBuffer;
        if (replacementImageUrl === 'replace') {
            const defaultReplacementImagePath = './replacement_face.png';
            replacementImageBuffer = await Jimp.read(defaultReplacementImagePath);
        } else {
            const response = await axios.get(replacementImageUrl, { responseType: 'stream' });
            const writer = fs.createWriteStream(tempGifPaths);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            replacementImageBuffer = await Jimp.read(tempGifPaths);
        }

        const classifiers = await loadClassifiersFromFolder(classifiersFolder);
        await gifToVideo(tempGifPath, tempVideoPath);

        console.log('开始读取视频文件...');
        const videoCapture = new cv.VideoCapture(tempVideoPath);
        const frameWidth = videoCapture.get(cv.CAP_PROP_FRAME_WIDTH);
        const frameHeight = videoCapture.get(cv.CAP_PROP_FRAME_HEIGHT);
        const originalFps = videoCapture.get(cv.CAP_PROP_FPS);
        const videoWriter = new cv.VideoWriter(
            outputVideoPath,
            cv.VideoWriter.fourcc('avc1'),
            originalFps,
            new cv.Size(frameWidth, frameHeight)
        );

        console.log('开始处理每一帧...');
        while (true) {
            const frame = videoCapture.read();
            if (frame.empty) break;

            const grayFrame = frame.bgrToGray();
            const faces = [];
            classifiers.forEach(classifier => {
                const allfaces = classifier.detectMultiScale(grayFrame).objects;
                faces.push(...allfaces);
            });

            if (Array.isArray(faces) && faces.length > 0) {
                console.log(`检测到 ${faces.length} 张脸`);
                for (const rect of faces) {
                    const resizedSubstituteImage = await replacementImageBuffer.clone().resize(rect.width, rect.height);
                    const substituteRegion = frame.getRegion(rect);
                    for (let y = 0; y < rect.height; y++) {
                        for (let x = 0; x < rect.width; x++) {
                            const { r, g, b, a } = Jimp.intToRGBA(resizedSubstituteImage.getPixelColor(x, y));
                            if (a > 0) {
                                const color = new cv.Vec3(b, g, r);
                                substituteRegion.set(y, x, color);
                            }
                        }
                    }
                }
            } else {
                console.error('未检测到人脸或faces数组为空');
                throw new Error('No faces detected in the frame.');
            }

            videoWriter.write(frame);
        }

        videoCapture.release();
        videoWriter.release();
        cv.destroyAllWindows();

        await videoToGif(outputVideoPath, outputGifPath);

        return {
            outputPath: outputGifPath,
            tempFiles
        };
    } catch (error) {
        // 清理临时文件
        tempFiles.forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });
        throw error;
    }
}

module.exports = {
    processGif,
    gifToVideo,
    videoToGif
};