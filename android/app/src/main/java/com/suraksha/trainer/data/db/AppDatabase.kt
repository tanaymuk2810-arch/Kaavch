package com.suraksha.trainer.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.suraksha.trainer.data.db.dao.CertificateDao
import com.suraksha.trainer.data.db.dao.ModuleDao
import com.suraksha.trainer.data.db.dao.SiteDao
import com.suraksha.trainer.data.db.dao.TrainingDao
import com.suraksha.trainer.data.db.dao.WorkerDao
import com.suraksha.trainer.data.db.entity.ArEventEntity
import com.suraksha.trainer.data.db.entity.CertificateEntity
import com.suraksha.trainer.data.db.entity.ModuleEntity
import com.suraksha.trainer.data.db.entity.ModuleProgressEntity
import com.suraksha.trainer.data.db.entity.SiteEntity
import com.suraksha.trainer.data.db.entity.TrainingAttemptEntity
import com.suraksha.trainer.data.db.entity.WorkerEntity

const val DB_NAME = "suraksha.db"

@Database(
    entities = [
        WorkerEntity::class,
        SiteEntity::class,
        ModuleEntity::class,
        ModuleProgressEntity::class,
        TrainingAttemptEntity::class,
        ArEventEntity::class,
        CertificateEntity::class
    ],
    version = 2,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun workerDao(): WorkerDao
    abstract fun siteDao(): SiteDao
    abstract fun moduleDao(): ModuleDao
    abstract fun trainingDao(): TrainingDao
    abstract fun certificateDao(): CertificateDao

    companion object {
        fun build(context: Context): AppDatabase =
            Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, DB_NAME)
                .fallbackToDestructiveMigration()
                .build()
    }
}