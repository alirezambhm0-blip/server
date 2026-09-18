import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private configService: ConfigService) {}

  @Cron(process.env.BACKUP_INTERVAL || '0 0 * * * *') // Default to every hour
  async handleCron() {
    this.logger.log('Starting scheduled database backup...');
    await this.createBackup();
    this.rotateBackups();
  }

  async createBackup() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    const backupDir = this.configService.get<string>('BACKUP_DIR', './backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestamp}.sql`;
    const filePath = path.join(backupDir, fileName);

    try {
      // Use proper argument array instead of string interpolation to prevent command injection
      // pg_dump accepts the database URL as the first argument
      const dbUrl = databaseUrl?.replace(/^postgresql:\/\//, '') || '';
      await execFileAsync('pg_dump', [dbUrl, '-f', filePath, '--no-password']);
      this.logger.log(`Backup created successfully: ${filePath}`);
    } catch (error: unknown) {
      this.logger.error('Failed to create database backup', (error as Error).stack);
    }
  }

  rotateBackups() {
    const backupDir = this.configService.get<string>('BACKUP_DIR', './backups');
    const maxFiles = Number(this.configService.get<number>('BACKUP_MAX_COUNT', 10));

    try {
      if (!fs.existsSync(backupDir)) return;

      const files = fs
        .readdirSync(backupDir)
        .filter((file) => file.startsWith('backup-') && file.endsWith('.sql'))
        .map((file) => ({
          name: file,
          time: fs.statSync(path.join(backupDir, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time); // Newest first

      if (files.length > maxFiles) {
        const toDelete = files.slice(maxFiles);
        for (const file of toDelete) {
          fs.unlinkSync(path.join(backupDir, file.name));
          this.logger.log(`Deleted old backup: ${file.name}`);
        }
      }
    } catch (error: unknown) {
      this.logger.error('Failed to rotate backups', (error as Error).stack);
    }
  }
}
