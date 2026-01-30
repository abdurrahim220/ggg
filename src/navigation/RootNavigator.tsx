import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomNavigator from './BottomNavigator';



const Stack = createNativeStackNavigator();

const RootNavigator=()=> {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={BottomNavigator} />
    </Stack.Navigator>
  );
}

export default RootNavigator;
