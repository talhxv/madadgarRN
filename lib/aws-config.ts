import AWS from 'aws-sdk';
import * as FileSystem from 'expo-file-system';

// Ensure credentials are loaded securely
const loadAwsCredentials = () => {
    const accessKey = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY;
    const secretKey = process.env.EXPO_PUBLIC_AWS_SECRET_KEY;

    if (!accessKey || !secretKey) {
        console.error('AWS credentials are missing!');
        throw new Error('AWS credentials must be set in environment variables');
    }

    return new AWS.Credentials({
        accessKeyId: accessKey,
        secretAccessKey: secretKey
    });
};

// Configure AWS with robust error handling
const configureAWS = () => {
    try {
        const credentials = loadAwsCredentials();

        AWS.config.update({
            credentials: credentials,
            region: 'eu-west-2',
            signatureVersion: 'v4'
        });
    } catch (error) {
        console.error('AWS Configuration Error:', error);
        throw error;
    }
};

// Initialize AWS configuration
configureAWS();

export const s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    signatureVersion: 'v4'
});

export const rekognition = new AWS.Rekognition({
    apiVersion: '2016-06-27'
});

export const uploadToS3 = async (imageUri: string, fileName: string) => {
    try {
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64
        });

        console.log('S3 Upload Attempt:', {
            Bucket: process.env.EXPO_PUBLIC_AWS_BUCKET_NAME,
            Key: fileName,
            Base64Length: base64.length
        });

        const uploadResult = await s3.upload({
            Bucket: process.env.EXPO_PUBLIC_AWS_BUCKET_NAME!,
            Key: fileName,
            Body: Uint8Array.from(atob(base64), c => c.charCodeAt(0)),
            ContentType: 'image/jpeg'
        }).promise();

        console.log('S3 Upload Success:', uploadResult);
        return uploadResult;
    } catch (error) {
        console.error('Detailed S3 Upload Error:', {
            message: error.message,
            code: error.code,
            name: error.name,
            fullError: error
        });
        throw error;
    }
};

export const compareFaces = async (nicImageUri: string, selfieImageUri: string) => {
    try {
        // Read NIC and Selfie images as base64
        const nicBase64 = await FileSystem.readAsStringAsync(nicImageUri, {
            encoding: FileSystem.EncodingType.Base64
        });

        const selfieBase64 = await FileSystem.readAsStringAsync(selfieImageUri, {
            encoding: FileSystem.EncodingType.Base64
        });

        // Debugging logs
        console.log('NIC Image Base64 Length:', nicBase64.length);
        console.log('Selfie Image Base64 Length:', selfieBase64.length);

        const params = {
            SourceImage: {
                Bytes: new Uint8Array(
                    atob(nicBase64)
                        .split('')
                        .map(char => char.charCodeAt(0))
                )
            },
            TargetImage: {
                Bytes: new Uint8Array(
                    atob(selfieBase64)
                        .split('')
                        .map(char => char.charCodeAt(0))
                )
            },
            SimilarityThreshold: 50 // Set similarity threshold
        };

        const data = await rekognition.compareFaces(params).promise();

        console.log('Face Comparison Results:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Face Comparison Error:', {
            message: error.message,
            code: error.code,
            name: error.name,
            fullError: JSON.stringify(error, null, 2)
        });
        throw error;
    }
};