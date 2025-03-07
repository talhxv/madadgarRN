export interface Education {
    id: string;
    institution_name: string;
    degree: string;
    field_of_study: string;
    start_date: string;
    end_date?: string;
    is_current: boolean;
    grade?: string;
    description?: string;
}

export interface Experience {
    id: string;
    company_name: string;
    position: string;
    location?: string;
    is_remote: boolean;
    start_date: string;
    end_date?: string;
    is_current: boolean;
    description?: string;
    skills?: string[];
    type: 'online' | 'offline' | 'hybrid';
}
