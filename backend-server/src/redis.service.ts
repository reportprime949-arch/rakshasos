import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  async onModuleInit() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('⚠️ [REDIS] Max retries reached. Operating without Redis cache.');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000);
        }
      });

      this.client.on('error', (err: any) => {
        // Silent fail to prevent process crash
        if (err.code === 'ECONNREFUSED') {

           // console.warn('⚠️ [REDIS] Connection Refused - check if redis is running');
        }
      });
    } catch (e) {
      console.warn('⚠️ [REDIS] Initialization failed:', e.message);
    }
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
