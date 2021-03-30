'use strict';

const querystring = require('querystring');
const aws = require('aws-sdk');
const s3 = new aws.S3({
  region: 'ap-northeast-2',
  signatureVersion: 'v4'
});
const sharp = require('sharp');
const BUCKET = 'xxxx';

exports.handler = async (event, context, callback) => {
  const response = event.Records[0].cf.response;

  const request = event.Records[0].cf.request;
  const params = querystring.parse(request.querystring);
  if (!params.d) { // example.com?d=100x100 의 형태가 아닐경우에는 원본 이미지를 반환합니다.
    callback(null, response);
    return;
  }
  const uri = request.uri;

  const imageSize = params.d.split("x");
  const width = parseInt(imageSize[0]);
  const height = parseInt(imageSize[1]);

  const [, imageName, extension] = uri.match(/\/(.*)\.(.*)/);

  const requiredFormat = extension == "jpg" ? "webp" : extension;// sharp에서는 jpg 대신 webp사용합니다
  const originalKey = imageName + "." + extension;
  try {
    const s3Object = await s3.getObject({ // S3에서 이미지를 받아 옵니다.
      Bucket: BUCKET,
      Key: originalKey
    }).promise();

    const resizedImage = await sharp(s3Object.Body)
      .resize(width, height)
      .toFormat(requiredFormat)
      .toBuffer();

    response.status = 200;
      //cache 에서 이미지를 찾지 못한 경우 이기 때문에 404가 발생하게 됩니다. 하지만 저희가 예상했던 동작이기 때문에 200 으로 반환하도록 하겠습니다.
    response.body = resizedImage.toString("base64");
    response.bodyEncoding = "base64";
    response.headers["content-type"] = [
      { key: "Content-Type", value: "image/" + requiredFormat }
    ];
    return callback(null, response);
  } catch (error) {
    console.error(error);
    return callback(error);
  }
};
