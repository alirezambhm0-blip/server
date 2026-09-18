import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchInputProps {
  query: string;
  setQuery: (text: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  onBack: () => void;
  placeholder?: string;
}

const COLORS = {
  textPrimary: '#0F172A',
  border: '#E2E8F0',
};

export const SearchInput: React.FC<SearchInputProps> = ({
  query,
  setQuery,
  onClear,
  onSubmit,
  onBack,
  placeholder = "نام محصول یا دسته‌بندی را جست‌وجو کنید",
}) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-forward" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>
      
      <View style={styles.inputContainer}>
        <Ionicons name="search-outline" size={18} color="#94A3B8" />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={onClear}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    height: 60, 
    paddingHorizontal: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFF'
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inputContainer: { 
    flex: 1, 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    height: 44, 
    backgroundColor: '#F8FAFC', 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    marginHorizontal: 8
  },
  input: { 
    flex: 1, 
    textAlign: 'right', 
    marginHorizontal: 10, 
    fontSize: 15, 
    color: COLORS.textPrimary,
    fontFamily: 'Vazirmatn',
    paddingVertical: Platform.OS === 'ios' ? 10 : 0
  },
});
