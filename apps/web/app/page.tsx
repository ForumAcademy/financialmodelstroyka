import { ENGINE_MODULES } from "@fm/engine";
import { SPEC_FILES } from "@fm/spec";

export default function HomePage() {
  return (
    <main className="page">
      <h1>Финансовая модель девелопера</h1>
      <p className="lead">
        Каркас сервиса (этап 0). Расчётов пока нет: список проектов, ввод данных и дашборд появятся на
        следующих этапах.
      </p>

      <section>
        <h2>Справочник — единственный источник правды</h2>
        <ul>
          {SPEC_FILES.map((file) => (
            <li key={file}>
              <code>data/{file}</code>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Модули расчётного ядра</h2>
        <table>
          <thead>
            <tr>
              <th>Модуль</th>
              <th>Что считает</th>
              <th>Этап</th>
            </tr>
          </thead>
          <tbody>
            {ENGINE_MODULES.map((m) => (
              <tr key={m.id}>
                <td>
                  <code>{m.id}</code>
                </td>
                <td>{m.title}</td>
                <td>{m.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
