
import { User, Exercise, WorkoutTemplate, WorkoutInstance } from '../types';

// Use relative URL in production, localhost in development
const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';

// Helper to get auth token
const getToken = (): string | null => {
  return localStorage.getItem('irontrack_token');
};

// Helper to set auth token
const setToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('irontrack_token', token);
  } else {
    localStorage.removeItem('irontrack_token');
  }
};

// Helper for authenticated requests
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }

  return response.json();
};

class DBService {
  // Auth
  getCurrentUser(): User | null {
    const data = localStorage.getItem('irontrack_current_user');
    return data ? JSON.parse(data) : null;
  }

  setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem('irontrack_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('irontrack_current_user');
      setToken(null);
    }
  }

  async login(username: string, password: string): Promise<User> {
    const response = await fetchWithAuth(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    setToken(response.access_token);
    this.setCurrentUser(response.user);
    return response.user;
  }

  async signup(username: string, password: string): Promise<User> {
    const response = await fetchWithAuth(`${API_URL}/auth/signup`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    setToken(response.access_token);
    this.setCurrentUser(response.user);
    return response.user;
  }

  // Exercises
  async getExercises(): Promise<Exercise[]> {
    return fetchWithAuth(`${API_URL}/exercises/`);
  }

  async addExercise(name: string): Promise<Exercise> {
    return fetchWithAuth(`${API_URL}/exercises/`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // Templates
  async getTemplates(userId: string): Promise<WorkoutTemplate[]> {
    return fetchWithAuth(`${API_URL}/templates/`);
  }

  async getTemplate(id: string): Promise<WorkoutTemplate> {
    return fetchWithAuth(`${API_URL}/templates/${id}`);
  }

  async saveTemplate(template: WorkoutTemplate): Promise<void> {
    // Check if template exists by trying to fetch it
    try {
      await this.getTemplate(template.id);
      // Template exists, update it
      await fetchWithAuth(`${API_URL}/templates/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: template.name,
          exercises: template.exercises,
          isPublic: template.isPublic,
        }),
      });
    } catch {
      // Template doesn't exist, create it
      await fetchWithAuth(`${API_URL}/templates/`, {
        method: 'POST',
        body: JSON.stringify({
          name: template.name,
          exercises: template.exercises,
          isPublic: template.isPublic,
        }),
      });
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    await fetchWithAuth(`${API_URL}/templates/${id}`, {
      method: 'DELETE',
    });
  }

  // Instances
  async getInstances(userId: string): Promise<WorkoutInstance[]> {
    return fetchWithAuth(`${API_URL}/instances/`);
  }

  async getInstance(id: string): Promise<WorkoutInstance> {
    return fetchWithAuth(`${API_URL}/instances/${id}`);
  }

  async saveInstance(instance: WorkoutInstance): Promise<void> {
    // Check if instance exists by trying to fetch it
    try {
      await this.getInstance(instance.id);
      // Instance exists, update it
      await fetchWithAuth(`${API_URL}/instances/${instance.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: instance.name,
          date: instance.date,
          exercises: instance.exercises,
          notes: instance.notes,
        }),
      });
    } catch {
      // Instance doesn't exist, create it
      await fetchWithAuth(`${API_URL}/instances/`, {
        method: 'POST',
        body: JSON.stringify({
          templateId: instance.templateId,
          name: instance.name,
          date: instance.date,
          exercises: instance.exercises,
          notes: instance.notes,
        }),
      });
    }
  }

  async deleteInstance(id: string): Promise<void> {
    await fetchWithAuth(`${API_URL}/instances/${id}`, {
      method: 'DELETE',
    });
  }

  // Legacy sync methods for backward compatibility
  getUsers(): User[] {
    // Not needed with backend
    return [];
  }

  addUser(user: User) {
    // Not needed with backend - use signup instead
  }
}

export const db = new DBService();
