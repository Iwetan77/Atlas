// The package ships its own .d.ts files but its package.json doesn't point at them.
declare module 'react-native-qrcode-styled' {
  export * from 'react-native-qrcode-styled/lib/typescript/module/src';
  export { default } from 'react-native-qrcode-styled/lib/typescript/module/src';
}
