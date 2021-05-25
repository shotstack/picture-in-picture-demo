'use strict';

const fs = require('fs');
const Joi = require('joi');

const SD_WIDTH = 1024;
const SD_HEIGHT = 576;
const PIP_VIDEO_INDEX = 0;
const VIDEO_INDEX = 1;

const scaleToOutputSize = (width, height, scale) => {
    const widthDivisor = (SD_WIDTH / width) * scale;
    const heightDivisor = (SD_HEIGHT / height) * scale;

    return Math.min(Math.round(widthDivisor * 100) / 100, Math.round(heightDivisor * 100) / 100);
}

const convertPaddingToOffsets = (padding, position) => {
    let xOffset = 0;
    let yOffset = 0;
    let xRatio = 1 - (SD_WIDTH - padding) / SD_WIDTH;
    let yRatio = 1 - (SD_HEIGHT - padding) / SD_HEIGHT;

    switch (position) {
        case 'topRight':
            xOffset = -xRatio;
            yOffset = -yRatio;
            break;
        case 'topLeft':
            xOffset = xRatio;
            yOffset = -yRatio;
            break;
        case 'bottomRight':
            xOffset = -xRatio;
            yOffset = yRatio;
            break;
        case 'bottomLeft':
            xOffset = xRatio;
            yOffset = yRatio;
            break;
    }

    return [Math.round(xOffset * 1000) / 1000, Math.round(yOffset * 1000) / 1000];
};

const validateBody = (body) => {
    const schema = Joi.object({
        video: Joi.string().uri().min(2).max(300).required(),
        pip: Joi.string().uri().min(2).max(300).required(),
        position: Joi.string().valid('topLeft', 'topRight', 'bottomLeft', 'bottomRight').required(),
        duration: Joi.number().min(0.1).max(120),
        padding: Joi.number().min(0).max(100),
        scale: Joi.number().min(0).max(2),
        pipWidth: Joi.number().min(0).max(1920),
        pipHeight: Joi.number().min(0).max(1080),
    });

    return schema.validate({
        video: body.video,
        pip: body.pip,
        position: body.position,
        duration: body.duration,
        padding: body.padding,
        scale: body.scale,
        pipWidth: body.pipWidth,
        pipHeight: body.pipHeight,
    });
};

const createJson = (body) => {
    return new Promise((resolve, reject) => {
        const valid = validateBody(body);

        if (valid.error) {
            reject(valid.error.details[0].message);
        }

        const pipVideoUrl = body.pip;
        const videoUrl = body.video;
        const position = body.position;
        const duration = parseFloat(body.duration) || 15;
        const [x, y] = convertPaddingToOffsets(parseInt(body.padding) || 20, position);
        const scale = scaleToOutputSize(body.pipWidth || SD_WIDTH, body.pipHeight || SD_HEIGHT, body.scale || 0.25) ;

        fs.readFile(__dirname + '/template.json', 'utf-8', function (err, data) {
            if (err) {
                console.error(err);
                reject(err);
            }

            let jsonParsed = JSON.parse(data);

            jsonParsed.timeline.tracks[PIP_VIDEO_INDEX].clips[0].asset.src = pipVideoUrl;
            jsonParsed.timeline.tracks[PIP_VIDEO_INDEX].clips[0].length = duration;
            jsonParsed.timeline.tracks[PIP_VIDEO_INDEX].clips[0].position = position;
            jsonParsed.timeline.tracks[PIP_VIDEO_INDEX].clips[0].offset.x = x;
            jsonParsed.timeline.tracks[PIP_VIDEO_INDEX].clips[0].offset.y = y;
            jsonParsed.timeline.tracks[PIP_VIDEO_INDEX].clips[0].scale = scale;
            jsonParsed.timeline.tracks[VIDEO_INDEX].clips[0].asset.src = videoUrl;
            jsonParsed.timeline.tracks[VIDEO_INDEX].clips[0].length = duration;

            const json = JSON.stringify(jsonParsed);

            return resolve(json);
        });
    });
};

module.exports = {
    createJson,
};
