import * as crypto from "crypto";
import * as stringify from "json-stable-stringify";
import * as fs from "fs";
import * as _ from "lodash";

export interface SignaturesConfig {
  publicKeysPath?: string;
  privateKeyPath?: string;
}

export class Signatures {
  config: SignaturesConfig;
  SIGNATURE_FORMAT: crypto.HexBase64Latin1Encoding = "base64";
  SIGNATURE_TYPE = "sha256";

  private publicKeys = new Map<string, string>();
  private privateKey: string;

  public constructor(signaturesConfig: SignaturesConfig) {
    this.config = signaturesConfig;

    this.readPrivateKey();
    this.readPublicKeys();
  }

  private readPrivateKey() {
    if (this.config.privateKeyPath) {
      this.privateKey = fs.readFileSync(this.config.privateKeyPath).toString();
    }
  }

  private readPublicKeys() {
    if (this.config.publicKeysPath) {
      fs.readdirSync(this.config.publicKeysPath).forEach((keyName) => {
        const contents = fs.readFileSync(`${this.config.publicKeysPath}/${keyName}`).toString();
        this.publicKeys.set(keyName, contents);
      });
    }
  }

  private signObject(object: any, key: string): string {
    const sign = crypto.createSign(this.SIGNATURE_TYPE);
    const payload = _.isBuffer(object) ? object : stringify(object);
    sign.update(payload);

    return sign.sign(key, this.SIGNATURE_FORMAT);
  }

  private verifyObject(object: any, signature: string, publicKey: string): boolean {
    const payload = _.isBuffer(object) ? object : stringify(object);
    const verify = crypto.createVerify(this.SIGNATURE_TYPE);
    verify.update(payload);

    return verify.verify(publicKey, signature, this.SIGNATURE_FORMAT);
  }

  public sign(object: any): string {
    return this.signObject(object, this.privateKey);
  }

  public verify(object: any, signature: string, publicKeyName: string): boolean {
    const publicKey = this.publicKeys.get(publicKeyName);
    return this.verifyObject(object, signature, publicKey);
  }
}