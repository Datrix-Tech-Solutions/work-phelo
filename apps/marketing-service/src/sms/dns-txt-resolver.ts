import { Injectable } from '@nestjs/common';
import { promises as dns } from 'dns';

export interface TxtResolver {
  resolveTxt(host: string): Promise<string[][]>;
}

@Injectable()
export class DnsTxtResolver implements TxtResolver {
  resolveTxt(host: string): Promise<string[][]> {
    return dns.resolveTxt(host);
  }
}
