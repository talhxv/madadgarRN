import React from 'react';
import { View, Text, Image } from 'react-native';

const Header = () => {
    return (
        <View className="h-[45%] bg-green-400 dark:bg-green-700 rounded-b-[50px] items-center justify-center">
            <Image
                source={require('@/assets/images/logo2.png')}
                className="w-32 h-32 mb-6"
                resizeMode="contain"
            />
            <Text className="text-5xl font-pbold text-white">
                Madadgar
            </Text>
        </View>
    );
};

export default Header;

