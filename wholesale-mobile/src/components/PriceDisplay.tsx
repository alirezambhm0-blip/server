// src/components/PriceDisplay.tsx
import { useAuth } from '../context/AuthContext';
import { Text } from 'react-native';

export const PriceDisplay = ({ price }: { price: number }) => {
  const { isApprovedCustomer } = useAuth();

  if (!isApprovedCustomer) {
    return <Text style={{ color: 'gray' }}>برای مشاهده قیمت باید تایید شوید</Text>;
  }

  return <Text>{price.toLocaleString()} تومان</Text>;
};
