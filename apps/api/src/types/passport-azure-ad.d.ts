declare module 'passport-azure-ad' {
  import { Strategy as PassportStrategy } from 'passport-strategy';

  interface IOIDCStrategyOption {
    identityMetadata: string;
    clientID: string;
    responseType: string;
    responseMode: string;
    redirectUrl: string;
    allowHttpForRedirectUrl?: boolean;
    clientSecret?: string;
    scope?: string[];
    logging?: boolean;
    nonce?: boolean | ((req: any, callback: (nonce: string) => void) => void);
    resource?: string;
  }

  interface IProfile {
    oid?: string;
    upn?: string;
    email?: string;
    displayName?: string;
    name?: {
      givenName?: string;
      surname?: string;
    };
  }

  class OIDCStrategy extends PassportStrategy {
    constructor(options: IOIDCStrategyOption, verify: (iss: string, sub: string, profile: IProfile, accessToken: string, refreshToken: string, done: (err: Error | null, user?: any, info?: any) => void) => void);
  }

  export { OIDCStrategy, IOIDCStrategyOption, IProfile };
}
