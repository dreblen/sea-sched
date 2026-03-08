<script setup lang="ts">
// Fixed data file that gets updated via script/hook
import PackageLicenses from '@/package-licenses.json'
</script>

<template>
    <v-container>
        <v-row>
            <v-col>
                <p class="text-h1 text-center">
                    Sea Sched
                </p>
                <p class="text-h5 text-center">
                    event staffing shift scheduler
                </p>
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <v-btn
                    block
                    color="primary"
                    to="/setup"
                >
                    Start Scheduling
                </v-btn>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12">
                If you want to learn more about how to use the application or
                see how it was made, you can...
            </v-col>
            <v-col cols="12">
                <v-btn
                  block
                  color="secondary"
                  append-icon="mdi-open-in-new"
                  href="https://github.com/dreblen/sea-sched"
                  target="blank"
                >
                  View on GitHub
                </v-btn>
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <p>
                    This app is running with the help of the following bundled
                    packages:
                </p>
                <v-expansion-panels variant="accordion">
                    <v-expansion-panel
                        v-for="(pack, i) in PackageLicenses"
                        :key="i"
                        :title="pack.name"
                    >
                        <v-expansion-panel-text>
                            <v-container>
                                <v-row>
                                    <v-col>
                                        <v-btn
                                            block
                                            append-icon="mdi-open-in-new"
                                            :href="`https://www.npmjs.com/package/${pack.name}`"
                                            target="blank"
                                        >
                                            Package Details
                                        </v-btn>
                                    </v-col>
                                </v-row>
                                <v-row>
                                    <v-col>
                                        <p
                                            v-for="(line, j) in pack.license.split('\n\n')"
                                            :key="j"
                                            class="my-3"
                                        >
                                            {{ line + '&nbsp;' }}
                                        </p>
                                    </v-col>
                                </v-row>
                            </v-container>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <p class="text-center">
                    Copyright © 2026-{{ (new Date).getFullYear() }} Tanner Jotblad
                </p>
            </v-col>
        </v-row>
    </v-container>
</template>
