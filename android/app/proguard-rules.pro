# Fully offline app — keep serialized Room entities + engine models
-keepclassmembers class com.suraksha.trainer.data.db.entity.** { *; }
-keep class kotlinx.serialization.** { *; }
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# SceneView (Filament based) ships its own rules
-keep class io.github.sceneview.** { *; }

# ZXing
-keep class com.google.zxing.** { *; }

# Room generated
-keep class * extends androidx.room.RoomDatabase { *; }