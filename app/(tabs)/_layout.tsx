import React from 'react';
import { View, Text } from 'react-native';
import {Tabs, Redirect} from "expo-router";
const TabsLayout = () => {
    return (
       <>
           <Tabs>
               <Tabs.Screen name="Home" />
           </Tabs>
       </>
    );
};

export default TabsLayout;