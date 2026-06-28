// forked from https://github.com/cwoffenden/hello-webgpu

#include <emscripten/emscripten.h>

/**
 * Entry point for the 'real' application.
 *
 * \param[in] argc count of program arguments in argv
 * \param[in] argv program arguments (excluding the application)
 */
extern "C" int __main__(int /*argc*/, char* /*argv*/[]);

//****************************************************************************/

/**
 * Entry point. With Emdawnwebgpu the WebGPU instance/adapter/device are
 * requested directly from C (see \c __main__), so no JavaScript pre-init is
 * required: the asynchronous callbacks run once \c main() returns and the
 * browser event loop continues.
 */
int main(int argc, char* argv[]) {
	return __main__(argc, argv);
}
