// Browsers ship TextEncoder and crypto; Solana libraries still expect a global Buffer.
import { Buffer } from 'buffer';

globalThis.Buffer = globalThis.Buffer ?? Buffer;
