import { describe, expect, it } from "vitest"
import { renderNotificationTemplate } from "@/lib/notifications/render-template"

describe("renderNotificationTemplate", () => {
  it("replaces known placeholders", () => {
    expect(
      renderNotificationTemplate("Hi {client_name}, see you at {time}.", {
        client_name: "Maya",
        time: "10:30 AM",
      })
    ).toBe("Hi Maya, see you at 10:30 AM.")
  })

  it("leaves unknown placeholders intact", () => {
    expect(renderNotificationTemplate("Hello {missing}", {})).toBe("Hello {missing}")
  })
})
