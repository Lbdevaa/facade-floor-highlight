import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Слои FSD, от верхнего к нижнему. Позиция в массиве задаёт направление импортов:
 * слой видит только слои правее себя. Экран в проекте один, поэтому pages и widgets
 * не заводятся — наполнять их нечем.
 */
const LAYERS = ['app', 'features', 'entities', 'shared']

/** Слои, у которых наружу торчит только публичный API слайса. */
const ENCAPSULATED = ['features', 'entities']

const downwardPolicies = LAYERS.map((layer, index) => ({
  from: {element: {type: layer}},
  allow: {to: {element: {types: {anyOf: LAYERS.slice(index + 1)}}}}
})).filter((policy) => policy.allow.to.element.types.anyOf.length > 0)

export default tseslint.config(
  {ignores: ['dist', 'node_modules', 'build']},

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      boundaries
    },
    settings: {
      // Резолвер нужен, чтобы импорты по алиасам (`entities/sceneConfig`) сопоставлялись со слоями.
      'import/resolver': {typescript: {project: './tsconfig.app.json'}},
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        // app — единый элемент: слайсов там нет, только композиция приложения.
        {type: 'app', pattern: 'src/app'},
        ...LAYERS.slice(1).map((layer) => ({
          type: layer,
          pattern: `src/${layer}/*`,
          capture: ['slice']
        }))
      ]
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      ...reactRefresh.configs.vite.rules,

      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // Импорт только вниз по слоям; слайсы одного слоя друг друга не видят.
            ...downwardPolicies,
            // shared замкнут на себя.
            {from: {element: {type: 'shared'}}, allow: {to: {element: {types: {anyOf: ['shared']}}}}},
            // Внутренности слайса наружу не торчат — только index.
            {
              disallow: {
                to: {element: {types: {anyOf: ENCAPSULATED}, fileInternalPath: '!index.{ts,tsx}'}}
              }
            }
          ]
        }
      ]
    }
  },

  // Конфигурационные файлы живут вне слоёв и вне браузерного окружения.
  {
    files: ['*.{ts,mjs}', 'scripts/**/*.{ts,mjs}'],
    languageOptions: {globals: globals.node}
  }
)
