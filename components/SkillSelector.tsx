import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { supabase } from '@/supabaseClient';
import { X } from 'lucide-react-native';

interface Skill {
    id: string;
    name: string;
}

interface SkillSelectorProps {
    onSkillsChange: (skills: string[]) => void;
    initialSkills: string[];
}

const SkillSelector: React.FC<SkillSelectorProps> = ({ onSkillsChange, initialSkills }) => {
    const [allSkills, setAllSkills] = useState<Skill[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);

    // Add this useEffect to handle initialSkills changes
    useEffect(() => {
        console.log('initialSkills changed:', initialSkills);
        setSelectedSkills(initialSkills || []);
    }, [initialSkills]);

    useEffect(() => {
        const fetchSkills = async () => {
            const { data, error } = await supabase.from('skills').select('*');
            if (data) {
                setAllSkills(data);
                setFilteredSkills(data);
            }
            if (error) {
                console.error("Error fetching skills:", error);
            }
        };

        fetchSkills();
    }, []);

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = allSkills.filter(skill =>
            skill.name.toLowerCase().includes(term) &&
            !selectedSkills.includes(skill.name)
        );
        setFilteredSkills(filtered);
    }, [searchTerm, allSkills, selectedSkills]);

    useEffect(() => {
        console.log('Selected skills changed:', selectedSkills);
        onSkillsChange(selectedSkills);
    }, [selectedSkills]);

    const handleSkillPress = (skill: Skill) => {
        if (!selectedSkills.includes(skill.name)) {
            const newSelectedSkills = [...selectedSkills, skill.name];
            setSelectedSkills(newSelectedSkills);
            setSearchTerm('');
            setShowDropdown(false);
        }
    };

    const removeSkill = (skillToRemove: string) => {
        const newSelectedSkills = selectedSkills.filter(skill => skill !== skillToRemove);
        setSelectedSkills(newSelectedSkills);
    };

    // Rest of your component code remains the same...
    return (
        <View style={styles.container}>
            <View style={styles.selectedSkillsContainer}>
                {selectedSkills.map(skill => (
                    <View key={skill} style={styles.selectedSkill}>
                        <Text style={styles.skillText}>{skill}</Text>
                        <TouchableOpacity onPress={() => removeSkill(skill)} style={styles.removeButton}>
                            <X size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchBar}
                    placeholder="Add a skill..."
                    onChangeText={setSearchTerm}
                    value={searchTerm}
                    onFocus={() => setShowDropdown(true)}
                />
            </View>

            {showDropdown && searchTerm && (
                <View style={styles.dropdown}>
                    {filteredSkills.length > 0 ? (
                        filteredSkills.slice(0, 5).map(skill => (
                            <TouchableOpacity
                                key={skill.id}
                                style={styles.dropdownItem}
                                onPress={() => handleSkillPress(skill)}
                            >
                                <Text>{skill.name}</Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.noResults}>No matching skills found</Text>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    searchContainer: {
        marginBottom: 8,
    },
    searchBar: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    dropdown: {
        position: 'absolute',
        top: 40 + 8, // height of search bar + marginBottom
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        zIndex: 1000,
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    noResults: {
        padding: 12,
        color: '#666',
        fontStyle: 'italic',
    },
    selectedSkillsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    selectedSkill: {
        backgroundColor: '#53F3AE',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    skillText: {
        color: 'white',
        marginRight: 4,
    },
    removeButton: {
        padding: 2,
    }
});

export default SkillSelector;