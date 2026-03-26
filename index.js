/**
 * @format
 */

import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Compatibility shim for legacy libraries expecting View.propTypes.style.
// react-native-snap-carousel@3.x reads this during module evaluation.
try {
  const { View } = require('react-native');
  if (View && !View.propTypes) {
    View.propTypes = {};
  }
  if (View && View.propTypes && !View.propTypes.style) {
    View.propTypes.style = () => null;
  }
} catch (error) {
  // No-op: keep app booting even if shim fails.
}

AppRegistry.registerComponent(appName, () => App);
