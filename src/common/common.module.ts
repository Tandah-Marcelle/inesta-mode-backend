import { Module, Global } from '@nestjs/common';
import { SkeletonService } from './skeleton.service';

@Global()
@Module({
  providers: [SkeletonService],
  exports: [SkeletonService],
})
export class CommonModule {}