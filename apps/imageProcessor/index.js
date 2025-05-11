const cv = require('@u4/opencv4nodejs');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');

// 从文件夹加载所有分类器
async function loadClassifiersFromFolder(folderPath) {
    console.log(`开始从文件夹 ${folderPath} 加载分类器...`);
    const classifiers = [];

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const classifier = new cv.CascadeClassifier(filePath);
        classifiers.push(classifier);
        console.log(`加载分类器: ${file}`);
    }

    console.log('分类器加载完成');
    return classifiers;
}

// 处理单张图片
async function processImage(imageUrl, replacementImageUrl, classifiersFolder) {
    const tempDir = os.tmpdir();
    const tempImagePath = path.join(tempDir, 'temp_image.jpg');
    const tempImagePaths = path.join(tempDir, 'temp_images.jpg');
    const outputImagePath = path.join(tempDir, 'output_image.jpg');

    try {
        console.log('开始下载图片...');
        const response = await axios.get(imageUrl, { responseType: 'stream' });
        const writer = fs.createWriteStream(tempImagePath);
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
            const writer = fs.createWriteStream(tempImagePaths);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            replacementImageBuffer = await Jimp.read(tempImagePaths);
        }

        const classifiers = await loadClassifiersFromFolder(classifiersFolder);
        const image = await cv.imreadAsync(tempImagePath);
        const grayImage = image.bgrToGray();

        console.log('开始检测人脸...');
        const faces = [];
        classifiers.forEach(classifier => {
            const allFaces = classifier.detectMultiScale(grayImage).objects;
            faces.push(...allFaces);
        });

        if (Array.isArray(faces) && faces.length > 0) {
            console.log(`检测到 ${faces.length} 张脸`);
            for (const rect of faces) {
                const resizedSubstituteImage = await replacementImageBuffer.clone().resize(rect.width, rect.height);
                const substituteRegion = image.getRegion(rect);
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
            throw new Error('No faces detected in the image.');
        }

        await cv.imwriteAsync(outputImagePath, image);
        console.log('图片处理完成并保存:', outputImagePath);

        return {
            outputPath: outputImagePath,
            tempFiles: [tempImagePath, tempImagePaths]
        };
    } catch (error) {
        // 清理临时文件
        if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
        if (fs.existsSync(tempImagePaths)) fs.unlinkSync(tempImagePaths);
        if (fs.existsSync(outputImagePath)) fs.unlinkSync(outputImagePath);
        throw error;
    }
}

module.exports = {
    processImage,
    loadClassifiersFromFolder
};