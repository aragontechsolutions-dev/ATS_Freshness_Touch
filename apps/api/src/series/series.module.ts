import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BookingsModule } from '../bookings/bookings.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { BookingSeriesController, SeriesController } from './series.controller';
import { SeriesSweepService } from './series-sweep.service';
import { SeriesService } from './series.service';

/**
 * LAS CLIENTAS DE SIEMPRE.
 *
 * Importa `BookingsModule` porque el barrido crea las citas con EL MISMO
 * servicio que el sitio publico y el panel. Tres caminos de creacion
 * distintos serian tres calculos de precio que se separan solos.
 */
@Module({
  imports: [ConfigModule, BookingsModule, SchedulingModule],
  controllers: [SeriesController, BookingSeriesController],
  providers: [SeriesService, SeriesSweepService],
  exports: [SeriesService],
})
export class SeriesModule {}
