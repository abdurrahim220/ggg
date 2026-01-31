package com.testsharingapp

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent
import android.util.Log

class RemoteControlAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "RemoteControlService"
        var instance: RemoteControlAccessibilityService? = null
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "Service Connected")
        instance = this
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        Log.d(TAG, "Service Unbound")
        instance = null
        return super.onUnbind(intent)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not needed for this implementation
    }

    override fun onInterrupt() {
        Log.d(TAG, "Service Interrupted")
        instance = null
    }

    fun injectClick(x: Float, y: Float) {
        Log.d(TAG, "Injecting click at: $x, $y")
        
        val path = Path()
        path.moveTo(x, y)
        
        val gestureBuilder = GestureDescription.Builder()
        gestureBuilder.addStroke(GestureDescription.StrokeDescription(path, 0, 50))
        
        dispatchGesture(gestureBuilder.build(), object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                super.onCompleted(gestureDescription)
                Log.d(TAG, "Gesture Completed")
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                super.onCancelled(gestureDescription)
                Log.d(TAG, "Gesture Cancelled")
            }
        }, null)
    }
}
