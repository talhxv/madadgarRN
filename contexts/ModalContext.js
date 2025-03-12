// Create a new file: contexts/ModalContext.js
import React, { createContext, useContext, useState } from 'react';

const ModalContext = createContext();

export function ModalProvider({ children }) {
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [hasCompleteProfile, setHasCompleteProfile] = useState(false);
    const [isCheckingProfile, setIsCheckingProfile] = useState(false);

    const showCreateModal = () => {
        setIsCreateModalVisible(true);
    };

    const hideCreateModal = () => {
        setIsCreateModalVisible(false);
    };

    const setProfileStatus = (status) => {
        setHasCompleteProfile(status);
    };

    const setCheckingStatus = (status) => {
        setIsCheckingProfile(status);
    };

    return (
        <ModalContext.Provider
            value={{
                isCreateModalVisible,
                showCreateModal,
                hideCreateModal,
                hasCompleteProfile,
                setProfileStatus,
                isCheckingProfile,
                setCheckingStatus
            }}
        >
            {children}
        </ModalContext.Provider>
    );
}

export function useModal() {
    return useContext(ModalContext);
}