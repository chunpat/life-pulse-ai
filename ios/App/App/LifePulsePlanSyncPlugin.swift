import Foundation
import Capacitor
import EventKit

@objc(LifePulsePlanSyncPlugin)
public class LifePulsePlanSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LifePulsePlanSyncPlugin"
    public let jsName = "LifePulsePlanSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "upsertPlan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deletePlan", returnType: CAPPluginReturnPromise)
    ]

    private let eventStore = EKEventStore()

    @objc public func getAuthorizationStatus(_ call: CAPPluginCall) {
        call.resolve(authorizationPayload())
    }

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        let requestedTarget = call.getString("syncTarget")

        if requestedTarget == "ios-calendar" {
            ensureAccess(for: .event) { granted, message in
                self.resolvePermissionCall(call, granted: granted, message: message)
            }
            return
        }

        if requestedTarget == "ios-reminder" {
            ensureAccess(for: .reminder) { granted, message in
                self.resolvePermissionCall(call, granted: granted, message: message)
            }
            return
        }

        ensureAccess(for: .event) { eventGranted, eventMessage in
            self.ensureAccess(for: .reminder) { reminderGranted, reminderMessage in
                let granted = eventGranted && reminderGranted
                let message = eventMessage ?? reminderMessage
                self.resolvePermissionCall(call, granted: granted, message: message)
            }
        }
    }

    @objc public func upsertPlan(_ call: CAPPluginCall) {
        guard let plan = call.getObject("plan") else {
            call.reject("缺少计划数据")
            return
        }

        guard let syncTarget = plan["syncTarget"] as? String else {
            call.reject("缺少 syncTarget")
            return
        }

        let entityType: EKEntityType
        switch syncTarget {
        case "ios-calendar":
            entityType = .event
        case "ios-reminder":
            entityType = .reminder
        default:
            call.resolve(failurePayload(message: "不支持的同步目标"))
            return
        }

        ensureAccess(for: entityType) { granted, message in
            guard granted else {
                call.resolve(self.permissionDeniedPayload(message: message ?? "未授予日历或提醒事项权限"))
                return
            }

            do {
                if syncTarget == "ios-calendar" {
                    let payload = try self.upsertEvent(from: plan, existingExternalId: call.getString("existingExternalId"))
                    call.resolve(payload)
                } else {
                    let payload = try self.upsertReminder(from: plan, existingExternalId: call.getString("existingExternalId"))
                    call.resolve(payload)
                }
            } catch {
                call.resolve(self.failurePayload(message: error.localizedDescription))
            }
        }
    }

    @objc public func deletePlan(_ call: CAPPluginCall) {
        guard let syncTarget = call.getString("syncTarget") else {
            call.reject("缺少 syncTarget")
            return
        }

        guard let externalId = call.getString("externalId"), !externalId.isEmpty else {
            call.reject("缺少 externalId")
            return
        }

        let entityType: EKEntityType = syncTarget == "ios-calendar" ? .event : .reminder
        ensureAccess(for: entityType) { granted, message in
            guard granted else {
                call.resolve(self.permissionDeniedPayload(message: message ?? "未授予删除系统计划所需权限"))
                return
            }

            guard let item = self.eventStore.calendarItem(withIdentifier: externalId) else {
                call.resolve(self.successPayload(externalId: externalId, externalContainerId: nil))
                return
            }

            do {
                if let event = item as? EKEvent {
                    try self.eventStore.remove(event, span: .thisEvent, commit: true)
                } else if let reminder = item as? EKReminder {
                    try self.eventStore.remove(reminder, commit: true)
                }

                call.resolve(self.successPayload(externalId: externalId, externalContainerId: nil))
            } catch {
                call.resolve(self.failurePayload(message: error.localizedDescription))
            }
        }
    }

    private func resolvePermissionCall(_ call: CAPPluginCall, granted: Bool, message: String?) {
        var payload = authorizationPayload()
        if let message {
            payload["message"] = message
        }
        payload["granted"] = granted
        call.resolve(payload)
    }

    private func authorizationPayload() -> [String: Any] {
        return [
            "calendar": authorizationState(for: .event),
            "reminder": authorizationState(for: .reminder)
        ]
    }

    private func authorizationState(for entityType: EKEntityType) -> String {
        let status = EKEventStore.authorizationStatus(for: entityType)

        if #available(iOS 17.0, *) {
            switch status {
            case .fullAccess, .writeOnly, .authorized:
                return "granted"
            case .notDetermined:
                return "prompt"
            case .restricted, .denied:
                return "denied"
            @unknown default:
                return "unavailable"
            }
        }

        switch status {
        case .authorized:
            return "granted"
        case .notDetermined:
            return "prompt"
        case .restricted, .denied:
            return "denied"
        @unknown default:
            return "unavailable"
        }
    }

    private func ensureAccess(for entityType: EKEntityType, completion: @escaping (Bool, String?) -> Void) {
        let status = authorizationState(for: entityType)
        if status == "granted" {
            completion(true, nil)
            return
        }

        if status == "denied" {
            completion(false, "请先在系统设置中授予访问权限")
            return
        }

        requestAccess(for: entityType, completion: completion)
    }

    private func requestAccess(for entityType: EKEntityType, completion: @escaping (Bool, String?) -> Void) {
        if #available(iOS 17.0, *) {
            if entityType == .event {
                eventStore.requestFullAccessToEvents { granted, error in
                    DispatchQueue.main.async {
                        completion(granted, error?.localizedDescription)
                    }
                }
            } else {
                eventStore.requestFullAccessToReminders { granted, error in
                    DispatchQueue.main.async {
                        completion(granted, error?.localizedDescription)
                    }
                }
            }
            return
        }

        eventStore.requestAccess(to: entityType) { granted, error in
            DispatchQueue.main.async {
                completion(granted, error?.localizedDescription)
            }
        }
    }

    private func upsertReminder(from plan: JSObject, existingExternalId: String?) throws -> [String: Any] {
        guard let title = plan["title"] as? String, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NSError(domain: "LifePulsePlanSync", code: 1001, userInfo: [NSLocalizedDescriptionKey: "提醒标题不能为空"])
        }

        let reminder = (existingExternalId.flatMap { eventStore.calendarItem(withIdentifier: $0) as? EKReminder }) ?? EKReminder(eventStore: eventStore)
        reminder.calendar = reminder.calendar ?? defaultReminderCalendar()
        reminder.title = title
        reminder.notes = plan["notes"] as? String

        if let dueAt = timestamp(from: plan["dueAt"] ?? plan["reminderAt"]) {
            reminder.dueDateComponents = dateComponents(from: dueAt, timeZoneIdentifier: plan["timezone"] as? String)
        } else {
            reminder.dueDateComponents = nil
        }

        clearAlarms(from: reminder)
        if let reminderAt = timestamp(from: plan["reminderAt"]) {
            reminder.addAlarm(EKAlarm(absoluteDate: date(from: reminderAt)))
        }

        let status = plan["status"] as? String ?? "pending"
        reminder.isCompleted = status == "completed"
        reminder.completionDate = reminder.isCompleted ? Date() : nil

        try eventStore.save(reminder, commit: true)
        return successPayload(
            externalId: reminder.calendarItemIdentifier,
            externalContainerId: reminder.calendar.calendarIdentifier
        )
    }

    private func upsertEvent(from plan: JSObject, existingExternalId: String?) throws -> [String: Any] {
        guard let title = plan["title"] as? String, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NSError(domain: "LifePulsePlanSync", code: 1002, userInfo: [NSLocalizedDescriptionKey: "日历事件标题不能为空"])
        }

        let event = (existingExternalId.flatMap { eventStore.calendarItem(withIdentifier: $0) as? EKEvent }) ?? EKEvent(eventStore: eventStore)
        event.calendar = event.calendar ?? defaultEventCalendar()
        event.title = title
        event.notes = plan["notes"] as? String

        let isAllDay = plan["isAllDay"] as? Bool ?? false
        event.isAllDay = isAllDay

        guard let startAt = timestamp(from: plan["startAt"] ?? plan["dueAt"] ?? plan["reminderAt"]) else {
            throw NSError(domain: "LifePulsePlanSync", code: 1003, userInfo: [NSLocalizedDescriptionKey: "日历事件缺少开始时间"])
        }

        let defaultDuration: TimeInterval = isAllDay ? 24 * 60 * 60 : 60 * 60
        let endAt = timestamp(from: plan["endAt"]) ?? (startAt + defaultDuration * 1000)
        event.startDate = date(from: startAt)
        event.endDate = date(from: endAt)

        clearAlarms(from: event)
        if let reminderAt = timestamp(from: plan["reminderAt"]) {
            event.addAlarm(EKAlarm(absoluteDate: date(from: reminderAt)))
        }

        try eventStore.save(event, span: .thisEvent, commit: true)
        return successPayload(
            externalId: event.calendarItemIdentifier,
            externalContainerId: event.calendar.calendarIdentifier
        )
    }

    private func clearAlarms(from reminder: EKReminder) {
        reminder.alarms?.forEach { reminder.removeAlarm($0) }
    }

    private func clearAlarms(from event: EKEvent) {
        event.alarms?.forEach { event.removeAlarm($0) }
    }

    private func defaultReminderCalendar() -> EKCalendar? {
        return eventStore.calendars(for: .reminder).first(where: { $0.allowsContentModifications })
    }

    private func defaultEventCalendar() -> EKCalendar? {
        return eventStore.defaultCalendarForNewEvents ?? eventStore.calendars(for: .event).first(where: { $0.allowsContentModifications })
    }

    private func timestamp(from value: Any?) -> Double? {
        if let number = value as? NSNumber {
            return number.doubleValue
        }

        if let string = value as? String {
            return Double(string)
        }

        return nil
    }

    private func date(from timestamp: Double) -> Date {
        return Date(timeIntervalSince1970: timestamp / 1000)
    }

    private func dateComponents(from timestamp: Double, timeZoneIdentifier: String?) -> DateComponents {
        let date = self.date(from: timestamp)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZoneIdentifier ?? "") ?? .current
        return calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
    }

    private func successPayload(externalId: String?, externalContainerId: String?) -> [String: Any] {
        return [
            "syncState": "synced",
            "externalId": externalId as Any,
            "externalContainerId": externalContainerId as Any
        ]
    }

    private func permissionDeniedPayload(message: String) -> [String: Any] {
        return [
            "syncState": "permission-denied",
            "message": message,
            "externalId": NSNull(),
            "externalContainerId": NSNull()
        ]
    }

    private func failurePayload(message: String) -> [String: Any] {
        return [
            "syncState": "failed",
            "message": message,
            "externalId": NSNull(),
            "externalContainerId": NSNull()
        ]
    }
}
