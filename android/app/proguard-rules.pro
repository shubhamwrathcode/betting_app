# -------------------------------
# ProGuard rules for com.betting_app
# Release build safe for Retrofit + Gson + Models
# -------------------------------

# Keep all your app models
-keep class com.betting_app.models.** { *; }

# Keep all network / API interfaces
-keep class com.betting_app.network.** { *; }

# Keep annotations and generic type signatures for serialization
-keepattributes Signature
-keepattributes *Annotation*

# Keep Retrofit classes
-keep class retrofit2.** { *; }

# Keep OkHttp classes
-keep class okhttp3.** { *; }

# Keep Gson classes for serialization
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapter { *; }

# Keep all Activities and Fragments (optional, prevents obfuscation)
-keep class com.betting_app.**Activity { *; }
-keep class com.betting_app.**Fragment { *; }

# Optional: keep Application class
-keep class com.betting_app.**Application { *; }

# Optional: Keep enums
-keepclassmembers enum * { *; }

# Optional: Keep all Parcelable classes
-keep class * implements android.os.Parcelable { *; }