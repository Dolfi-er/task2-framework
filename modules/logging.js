export default {
  name: "Logging",
  contractVersion: "1.0",
  requires: ["Core"],
  register(container) {
    container.addSingleton("action.logging", () => ({
      title: "Проверка журнала событий",
      async execute() {
        console.log("Logging: сообщение из модуля журналирования");
      }
    }));
  },
  async init(container) {}
};