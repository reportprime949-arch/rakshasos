import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  async onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async updateResponderLocation(officerId: string, lat: number, lng: number) {
    await this.client.geoadd('active_responders', lng, lat, officerId);
    await this.client.hset(`responder:${officerId}`, {
      lastUpdate: Date.now().toString(),
      lat: lat.toString(),
      lng: lng.toString(),
    });
  }

  async getNearestResponders(lat: number, lng: number, radiusKm: number = 10): Promise<any[]> {
    // ioredis geosearch returns [[member, distance], ...] or similar based on arguments
    return this.client.geosearch(
      'active_responders',
      'FROMLONLAT',
      lng,
      lat,
      'BYRADIUS',
      radiusKm,
      'km',
      'WITHDIST',
      'ASC'
    ) as any;
  }

  async setResponderStatus(officerId: string, status: string) {
    await this.client.hset(`responder:${officerId}`, 'status', status);
    if (status === 'OFFLINE') {
      await this.client.zrem('active_responders', officerId);
    }
  }

  async getResponderStatus(officerId: string): Promise<string | null> {
    return this.client.hget(`responder:${officerId}`, 'status');
  }
}
