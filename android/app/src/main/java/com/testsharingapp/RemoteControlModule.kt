package com.testsharingapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.util.Log

class RemoteControlModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "RemoteControl"
    }

    @ReactMethod
    fun performClick(x: Float, y: Float) {
        val service = RemoteControlAccessibilityService.instance
        if (service != null) {
            Log.d("RemoteControlModule", "Calling service to inject click at: $x, $y")
            service.injectClick(x, y)
        } else {
            Log.e("RemoteControlModule", "Accessibility Service not running!")
        }
    }
}
