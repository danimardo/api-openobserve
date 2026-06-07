import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class OpenObserveClient {
  readonly http: AxiosInstance;

  constructor(private readonly config: AppConfigService) {
    this.http = axios.create({
      baseURL: `${config.env.O2_URL}/api/${config.env.O2_ORG}`,
      auth: {
        username: config.env.O2_AUTH_USER,
        password: config.env.O2_AUTH_PASSWORD,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    });
  }
}
