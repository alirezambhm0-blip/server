import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'موضوع تیکت الزامی است' })
  @MaxLength(100, { message: 'موضوع تیکت بسیار طولانی است' })
  subject!: string; // اصلاح شد

  @IsString()
  @IsNotEmpty({ message: 'متن پیام الزامی است' })
  @MinLength(5, { message: 'متن پیام بسیار کوتاه است' })
  @MaxLength(1000, { message: 'متن پیام بسیار طولانی است' })
  message!: string; // اصلاح شد
}

export class ReplyTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'متن پیام الزامی است' })
  @MinLength(2, { message: 'متن پیام بسیار کوتاه است' })
  @MaxLength(1000, { message: 'متن پیام بسیار طولانی است' })
  message!: string; // اصلاح شد
}
