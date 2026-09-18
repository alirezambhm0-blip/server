import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class PushTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'توکن الزامی است' })
  token: string;

  @IsString()
  @IsNotEmpty({ message: 'پلتفرم الزامی است' })
  @IsIn(['ios', 'android', 'web'], { message: 'پلتفرم نامعتبر است' })
  platform: string;
}
