import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DPoPService {
    async generateDpopProof(url: string, method: string, nonce: string | null = null): Promise<string> {
        const keyPair = await this.getOrCreateDpopKeyPair();
      
        const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
        publicKeyJwk.alg = "RS256";
      
        const header = {
          alg: "RS256",
          typ: "dpop+jwt",
          jwk: publicKeyJwk,
        };
      
        const payload: any = {
          jti: this.generateUUID(),
          htm: method.toUpperCase(),
          htu: new URL(url).origin + new URL(url).pathname,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300, // Expires in 5 minutes
        };
      
        // ✅ Include nonce if provided
        if (nonce) {
          payload.nonce = nonce;
        }
      
        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
      
        const signature = await crypto.subtle.sign(
          { name: "RSASSA-PKCS1-v1_5" },
          keyPair.privateKey,
          new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
        );
      
        const encodedSignature = this.base64UrlEncode(
          String.fromCharCode(...new Uint8Array(signature))
        );
      
        return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
      }
      
      base64UrlEncode(str: string): string {
        return btoa(str)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      }
    
      async getOrCreateDpopKeyPair(): Promise<CryptoKeyPair> {
        const storedPublicKey = localStorage.getItem('dpopPublicKey');
        const storedPrivateKey = sessionStorage.getItem('dpopPrivateKey');
      
        if (storedPublicKey && storedPrivateKey) {
          return {
            publicKey: await crypto.subtle.importKey(
              'jwk',
              JSON.parse(storedPublicKey),
              { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
              true,
              ['verify']
            ),
            privateKey: await crypto.subtle.importKey(
              'jwk',
              JSON.parse(storedPrivateKey),
              { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
              true,
              ['sign']
            )
          };
        }
      
        const keyPair = await crypto.subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: { name: 'SHA-256' },
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
          },
          true,
          ['sign', 'verify']
        );
      
        localStorage.setItem('dpopPublicKey', JSON.stringify(await crypto.subtle.exportKey('jwk', keyPair.publicKey)));
        sessionStorage.setItem('dpopPrivateKey', JSON.stringify(await crypto.subtle.exportKey('jwk', keyPair.privateKey)));
      
        return keyPair;
      }
      
      generateUUID(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
      
        return [...array].map(b => b.toString(16).padStart(2, '0')).join('');
      }

      clearDpopKeyPair() {
        localStorage.removeItem('dpopPublicKey');
        sessionStorage.removeItem('dpopPrivateKey');
      }
}