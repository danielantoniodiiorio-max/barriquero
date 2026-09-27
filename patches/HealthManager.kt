package app.capgo.plugin.health

import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Length
import androidx.health.connect.client.units.Mass
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlin.collections.buildSet
import kotlin.math.min

class HealthManager {

    private val formatter: DateTimeFormatter = DateTimeFormatter.ISO_INSTANT

    fun permissionsFor(readTypes: Collection<HealthDataType>, writeTypes: Collection<HealthDataType>): Set<String> = buildSet {
        readTypes.forEach { add(it.readPermission) }
        writeTypes.forEach { add(it.writePermission) }
    }

    suspend fun authorizationStatus(
        client: HealthConnectClient,
        readTypes: Collection<HealthDataType>,
        writeTypes: Collection<HealthDataType>
    ): JSObject {
        val granted = client.permissionController.getGrantedPermissions()

        val readAuthorized = JSArray()
        val readDenied = JSArray()
        readTypes.forEach { type ->
            if (granted.contains(type.readPermission)) {
                readAuthorized.put(type.identifier)
            } else {
                readDenied.put(type.identifier)
            }
        }

        val writeAuthorized = JSArray()
        val writeDenied = JSArray()
        writeTypes.forEach { type ->
            if (granted.contains(type.writePermission)) {
                writeAuthorized.put(type.identifier)
            } else {
                writeDenied.put(type.identifier)
            }
        }

        return JSObject().apply {
            put("readAuthorized", readAuthorized)
            put("readDenied", readDenied)
            put("writeAuthorized", writeAuthorized)
            put("writeDenied", writeDenied)
        }
    }

    suspend fun readSamples(
        client: HealthConnectClient,
        dataType: HealthDataType,
        startTime: Instant,
        endTime: Instant,
        limit: Int,
        ascending: Boolean
    ): JSArray {
        val samples = mutableListOf<Pair<Instant, JSObject>>()
        when (dataType) {
            HealthDataType.STEPS -> {
                var readSuccess = false
                try {
                    readRecords(client, StepsRecord::class, startTime, endTime, limit) { record ->
                        val payload = createSamplePayload(
                            dataType,
                            record.startTime,
                            record.endTime,
                            record.count.toDouble(),
                            record.metadata
                        )
                        samples.add(record.startTime to payload)
                    }
                    readSuccess = true
                } catch (e: Throwable) {
                    Log.w("HealthManager", "readRecords StepsRecord threw exception: ${e.message}. Using aggregate fallback.")
                }

                // If readRecords failed (e.g. IllegalArgumentException count < 1) or returned 0 samples,
                // query Health Connect's aggregate API which aggregates at the database level and never crashes on 0-count intervals.
                if (!readSuccess) {
                    samples.clear()
                }

                if (samples.isEmpty()) {
                    try {
                        val agg = client.aggregate(
                            AggregateRequest(
                                metrics = setOf(StepsRecord.COUNT_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                            )
                        )
                        val totalSteps = agg[StepsRecord.COUNT_TOTAL] ?: 0L
                        if (totalSteps > 0L) {
                            val payload = JSObject().apply {
                                put("dataType", dataType.identifier)
                                put("value", totalSteps.toDouble())
                                put("unit", dataType.unit)
                                put("startDate", formatter.format(startTime))
                                put("endDate", formatter.format(endTime))
                                put("sourceId", "com.garmin.android.apps.connectmobile")
                                put("sourceName", "Garmin Connect")
                            }
                            samples.add(startTime to payload)
                        }
                    } catch (aggErr: Throwable) {
                        Log.e("HealthManager", "Steps aggregate fallback error: ${aggErr.message}")
                    }
                }
            }

            HealthDataType.CALORIES -> {
                var readSuccess = false
                try {
                    readRecords(client, ActiveCaloriesBurnedRecord::class, startTime, endTime, limit) { record ->
                        val payload = createSamplePayload(
                            dataType,
                            record.startTime,
                            record.endTime,
                            record.energy.inKilocalories,
                            record.metadata
                        )
                        samples.add(record.startTime to payload)
                    }
                    readSuccess = true
                } catch (e: Throwable) {
                    Log.w("HealthManager", "readRecords ActiveCaloriesBurnedRecord threw: ${e.message}. Using aggregate fallback.")
                }

                if (!readSuccess) {
                    samples.clear()
                }

                if (samples.isEmpty()) {
                    try {
                        val agg = client.aggregate(
                            AggregateRequest(
                                metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                            )
                        )
                        val energy = agg[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]
                        val totalKcal = energy?.inKilocalories ?: 0.0
                        if (totalKcal > 0.0) {
                            val payload = JSObject().apply {
                                put("dataType", dataType.identifier)
                                put("value", totalKcal)
                                put("unit", dataType.unit)
                                put("startDate", formatter.format(startTime))
                                put("endDate", formatter.format(endTime))
                                put("sourceId", "com.garmin.android.apps.connectmobile")
                                put("sourceName", "Garmin Connect")
                            }
                            samples.add(startTime to payload)
                        }
                    } catch (aggErr: Throwable) {
                        Log.e("HealthManager", "Calories aggregate fallback error: ${aggErr.message}")
                    }
                }
            }

            HealthDataType.DISTANCE -> {
                try {
                    readRecords(client, DistanceRecord::class, startTime, endTime, limit) { record ->
                        val payload = createSamplePayload(
                            dataType,
                            record.startTime,
                            record.endTime,
                            record.distance.inMeters,
                            record.metadata
                        )
                        samples.add(record.startTime to payload)
                    }
                } catch (e: Throwable) {
                    Log.w("HealthManager", "readRecords DistanceRecord threw: ${e.message}")
                }
            }

            HealthDataType.WEIGHT -> {
                try {
                    readRecords(client, WeightRecord::class, startTime, endTime, limit) { record ->
                        val payload = createSamplePayload(
                            dataType,
                            record.time,
                            record.time,
                            record.weight.inKilograms,
                            record.metadata
                        )
                        samples.add(record.time to payload)
                    }
                } catch (e: Throwable) {
                    Log.w("HealthManager", "readRecords WeightRecord threw: ${e.message}")
                }
            }

            HealthDataType.HEART_RATE -> {
                try {
                    readRecords(client, HeartRateRecord::class, startTime, endTime, limit) { record ->
                        record.samples.forEach { sample ->
                            val payload = createSamplePayload(
                                dataType,
                                sample.time,
                                sample.time,
                                sample.beatsPerMinute.toDouble(),
                                record.metadata
                            )
                            samples.add(sample.time to payload)
                        }
                    }
                } catch (e: Throwable) {
                    Log.w("HealthManager", "readRecords HeartRateRecord threw: ${e.message}")
                }
            }
        }

        val sorted = samples.sortedBy { it.first }
        val ordered = if (ascending) sorted else sorted.asReversed()
        val limited = if (limit > 0) ordered.take(limit) else ordered

        val array = JSArray()
        limited.forEach { array.put(it.second) }
        return array
    }

    private suspend fun <T : Record> readRecords(
        client: HealthConnectClient,
        recordClass: kotlin.reflect.KClass<T>,
        startTime: Instant,
        endTime: Instant,
        limit: Int,
        consumer: (record: T) -> Unit
    ) {
        var pageToken: String? = null
        val pageSize = if (limit > 0) min(limit, MAX_PAGE_SIZE) else DEFAULT_PAGE_SIZE
        var fetched = 0

        do {
            val request = ReadRecordsRequest(
                recordType = recordClass,
                timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                pageSize = pageSize,
                pageToken = pageToken
            )
            val response = client.readRecords(request)
            response.records.forEach { record ->
                consumer(record)
            }
            fetched += response.records.size
            pageToken = response.pageToken
        } while (pageToken != null && (limit <= 0 || fetched < limit))
    }

    @Suppress("UNUSED_PARAMETER")
    suspend fun saveSample(
        client: HealthConnectClient,
        dataType: HealthDataType,
        value: Double,
        startTime: Instant,
        endTime: Instant,
        metadata: Map<String, String>?
    ) {
        when (dataType) {
            HealthDataType.STEPS -> {
                val countVal = value.toLong().coerceAtLeast(1)
                val record = StepsRecord(
                    startTime = startTime,
                    startZoneOffset = zoneOffset(startTime),
                    endTime = endTime,
                    endZoneOffset = zoneOffset(endTime),
                    count = countVal
                )
                client.insertRecords(listOf(record))
            }
            HealthDataType.DISTANCE -> {
                val record = DistanceRecord(
                    startTime = startTime,
                    startZoneOffset = zoneOffset(startTime),
                    endTime = endTime,
                    endZoneOffset = zoneOffset(endTime),
                    distance = Length.meters(value)
                )
                client.insertRecords(listOf(record))
            }
            HealthDataType.CALORIES -> {
                val record = ActiveCaloriesBurnedRecord(
                    startTime = startTime,
                    startZoneOffset = zoneOffset(startTime),
                    endTime = endTime,
                    endZoneOffset = zoneOffset(endTime),
                    energy = Energy.kilocalories(value)
                )
                client.insertRecords(listOf(record))
            }
            HealthDataType.WEIGHT -> {
                val record = WeightRecord(
                    time = startTime,
                    zoneOffset = zoneOffset(startTime),
                    weight = Mass.kilograms(value)
                )
                client.insertRecords(listOf(record))
            }
            HealthDataType.HEART_RATE -> {
                val samples = listOf(HeartRateRecord.Sample(time = startTime, beatsPerMinute = value.toBpmLong()))
                val record = HeartRateRecord(
                    startTime = startTime,
                    startZoneOffset = zoneOffset(startTime),
                    endTime = endTime,
                    endZoneOffset = zoneOffset(endTime),
                    samples = samples
                )
                client.insertRecords(listOf(record))
            }
        }
    }

    fun parseInstant(value: String?, defaultInstant: Instant): Instant {
        if (value.isNullOrBlank()) {
            return defaultInstant
        }
        return Instant.parse(value)
    }

    private fun createSamplePayload(
        dataType: HealthDataType,
        startTime: Instant,
        endTime: Instant,
        value: Double,
        metadata: Metadata
    ): JSObject {
        val payload = JSObject()
        payload.put("dataType", dataType.identifier)
        payload.put("value", value)
        payload.put("unit", dataType.unit)
        payload.put("startDate", formatter.format(startTime))
        payload.put("endDate", formatter.format(endTime))

        val dataOrigin = metadata.dataOrigin
        payload.put("sourceId", dataOrigin.packageName)
        payload.put("sourceName", dataOrigin.packageName)
        metadata.device?.let { device ->
            val manufacturer = device.manufacturer?.takeIf { it.isNotBlank() }
            val model = device.model?.takeIf { it.isNotBlank() }
            val label = listOfNotNull(manufacturer, model).joinToString(" ").trim()
            if (label.isNotEmpty()) {
                payload.put("sourceName", label)
            }
        }

        return payload
    }

    private fun zoneOffset(instant: Instant): ZoneOffset? {
        return ZoneId.systemDefault().rules.getOffset(instant)
    }

    private fun Double.toBpmLong(): Long {
        return java.lang.Math.round(this.coerceAtLeast(0.0))
    }

    companion object {
        private const val DEFAULT_PAGE_SIZE = 100
        private const val MAX_PAGE_SIZE = 500
    }
}
