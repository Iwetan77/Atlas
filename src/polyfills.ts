// Crypto polyfills the Privy Expo SDK needs. Must load before anything else touches crypto.
import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';
import { Buffer } from 'buffer';

global.Buffer = global.Buffer ?? Buffer;
